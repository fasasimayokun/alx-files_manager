import { ObjectId } from 'mongodb';
import mime from 'mime-types';
import Queue from 'bull';
import userUtils from '../utils/user';
import fileUtils from '../utils/file';
import basicUtils from '../utils/basic';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

const fileQueue = new Queue('fileQueue');

class FilesController {
  /**
   * this will create a new file in DB and in disk
   *
   * Retrieve the user based on the token:
   * If not found, return an error Unauthorized with a status code 401
   * To create a file, you must specify:
   * name: as filename
   * type: either folder, file or image
   * isPublic: same as the value received
   * parentId: same as the value received - if not present: 0
   * localPath: for a type=file|image, the absolute path to the file save in local
   * Return the new file with a status code 201
   */
  static async postUpload(request, response) {
    const { userId } = await userUtils.getUserIdAndKey(request);

    if (!basicUtils.isValidId(userId)) {
      return response.status(401).send({ error: 'Unauthorized' });
    }
    if (!userId && request.body.type === 'image') {
      await fileQueue.add({});
    }

    const user = await userUtils.getUser({
      _id: ObjectId(userId),
    });

    if (!user) return response.status(401).send({ error: 'Unauthorized' });

    const { error: validationError, fileParams } = await fileUtils.validateBody(
      request,
    );

    if (validationError) {
	    return response.status(400).send({ error: validationError });
    }

    if (fileParams.parentId !== 0 && !basicUtils.isValidId(fileParams.parentId)) {
	    return response.status(400).send({ error: 'Parent not found' });
    }

    const { error, code, newFile } = await fileUtils.saveFile(
      userId,
      fileParams,
      FOLDER_PATH,
    );

    if (error) {
      if (response.body.type === 'image') await fileQueue.add({ userId });
      return response.status(code).send(error);
    }

    if (fileParams.type === 'image') {
      await fileQueue.add({
        fileId: newFile.id.toString(),
        userId: newFile.userId.toString(),
      });
    }

    return response.status(201).send(newFile);
  }

  /**
   * this will retrieve the file document based on the ID
   *
   * retrieves the user based on the token:
   * If not found, return an error Unauthorized with a status code 401
   * If no file document is linked to the user and the ID passed as
   * parameter, return an error Not found with a status code 404
   * else, return the file document
   */
  static async getShow(request, response) {
    const fileId = request.params.id;

    const { userId } = await userUtils.getUserIdAndKey(request);

    const user = await userUtils.getUser({
      _id: ObjectId(userId),
    });

    if (!user) return response.status(401).send({ error: 'Unauthorized' });

    // the mongo Condition for Id
    if (!basicUtils.isValidId(fileId) || !basicUtils.isValidId(userId)) {
	    return response.status(404).send({ error: 'Not found' });
    }

    const result = await fileUtils.getFile({
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    });

    if (!result) return response.status(404).send({ error: 'Not found' });

    const file = fileUtils.processFile(result);

    return response.status(200).send(file);
  }

  /**
   * it will retrieve all users file documents for a specific
   * parentId and with pagination
   *
   * Retrieve the user based on the token:
   * parentId:
   * No validation of parentId needed - if the parentId is not linked to any user folder,
   * returns an empty list
   * By default, parentId is equal to 0 = the root
   * Pagination:
   * Each page should be 20 items max
   * Pagination can be done directly by the aggregate of MongoDB
   */
  static async getIndex(request, response) {
    const { userId } = await userUtils.getUserIdAndKey(request);

    const user = await userUtils.getUser({
      _id: ObjectId(userId),
    });

    if (!user) return response.status(401).send({ error: 'Unauthorized' });

    let parentId = request.query.parentId || '0';

    if (parentId === '0') parentId = 0;

    let page = Number(request.query.page) || 0;

    if (Number.isNaN(page)) page = 0;

    if (parentId !== 0 && parentId !== '0') {
      if (!basicUtils.isValidId(parentId)) {
	      return response.status(401).send({ error: 'Unauthorized' });
      }

      parentId = ObjectId(parentId);

      const folder = await fileUtils.getFile({
        _id: ObjectId(parentId),
      });

      if (!folder || folder.type !== 'folder') {
	      return response.status(200).send([]);
      }
    }

    const pipeline = [
      { $match: { parentId } },
      { $skip: page * 20 },
      {
        $limit: 20,
      },
    ];

    const fileCursor = await fileUtils.getFilesOfParentId(pipeline);

    const fileList = [];
    await fileCursor.forEach((doc) => {
      const document = fileUtils.processFile(doc);
      fileList.push(document);
    });

    return response.status(200).send(fileList);
  }

  /**
   * this will set isPublic to true on the file document based on the ID
   *
   * retrieves the user based on the token:
   * If not found, return an error Unauthorized with a status code 401
   * If no file document is linked to the user and the ID passed as parameter,
   * return an error Not found with a status code 404
   * else:
   * update the value of isPublic to true
   * returns the file document with a status code 200
   */
  static async putPublish(request, response) {
    const { error, code, updatedFile } = await fileUtils.publishUnpublish(
      request,
      true,
    );

    if (error) return response.status(code).send({ error });

    return response.status(code).send(updatedFile);
  }

  /**
   * this will set isPublic to false on the file document based on the ID
   *
   * Retrieve the user based on the token:
   * If not found, return an error Unauthorized with a status code 401
   * If no file document is linked to the user and the ID passed as parameter,
   * return an error Not found with a status code 404
   * else:
   * update the value of isPublic to false
   * returns the file document with a status code 200
   */
  static async putUnpublish(request, response) {
    const { error, code, updatedFile } = await fileUtils.publishUnpublish(
      request,
      false,
    );

    if (error) return response.status(code).send({ error });

    return response.status(code).send(updatedFile);
  }

  /**
   * this will return the content of the file document based on the ID
   *
   * If no file document is linked to the ID passed as parameter, return an error
   * Not found with a status code 404
   * file, return an error Not found with a status code 404
   * If the type of the file document is folder, return an error A folder doesn't have content
   * with a status code 400
   * If the file is not locally present, return an error Not found with a status code 404
   * else:
   * Return the content of the file with the correct MIME-type
   */
  static async getFile(request, response) {
    const { userId } = await userUtils.getUserIdAndKey(request);
    const { id: fileId } = request.params;
    const size = request.query.size || 0;

    // the mongo Condition for Id
    if (!basicUtils.isValidId(fileId)) { return response.status(404).send({ error: 'Not found' }); }

    const file = await fileUtils.getFile({
      _id: ObjectId(fileId),
    });

    if (!file || !fileUtils.isOwnerAndPublic(file, userId)) { return response.status(404).send({ error: 'Not found' }); }

    if (file.type === 'folder') {
      return response
        .status(400)
        .send({ error: "A folder doesn't have content" });
    }

    const { error, code, data } = await fileUtils.getFileData(file, size);

    if (error) return response.status(code).send({ error });

    const mimeType = mime.contentType(file.name);

    response.setHeader('Content-Type', mimeType);

    return response.status(200).send(data);
  }
}

export default FilesController;
