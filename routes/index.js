import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

function controllerRouting(app) {
  const router = express.Router();
  app.use('/', router);

  // the App Controller routers

  // this will return if Redis is alive and if the DB is alive
  router.get('/status', (req, res) => {
    AppController.getStatus(req, res);
  });

  // this will return the number of users and files in DB
  router.get('/stats', (req, res) => {
    AppController.getStats(req, res);
  });

  // the routers for user Controller

  // this router will create a new user in DB
  router.post('/users', (req, res) => {
    UsersController.postNew(req, res);
  });

  // this will retrieve the user base on the token used
  router.get('/users/me', (req, res) => {
    UsersController.getMe(req, res);
  });

  // the auth Controller router

  // this will sign-in the user by generating a new authentication token
  router.get('/connect', (req, res) => {
    AuthController.getConnect(req, res);
  });

  // this will sign-out the user based on the token
  router.get('/disconnect', (req, res) => {
    AuthController.getDisconnect(req, res);
  });

  // the files Controller routers

  // this router will create a new file in DB and in disk
  router.post('/files', (req, res) => {
    FilesController.postUpload(req, res);
  });

  // this router will retrieve the file document based on the ID
  router.get('/files/:id', (req, res) => {
    FilesController.getShow(req, res);
  });

  // this router will retrieve all users file documents for a
  // specific parentId and with pagination
  router.get('/files', (req, res) => {
    FilesController.getIndex(req, res);
  });

  // this will set isPublic to true on the file document based on the ID
  router.put('/files/:id/publish', (req, res) => {
    FilesController.putPublish(req, res);
  });

  // this will set isPublic false on the file document based on the ID
  router.put('/files/:id/unpublish', (req, res) => {
    FilesController.putUnpublish(req, res);
  });

  // this will return the content of the file document based on the ID
  router.get('/files/:id/data', (req, res) => {
    FilesController.getFile(req, res);
  });
}

export default controllerRouting;
