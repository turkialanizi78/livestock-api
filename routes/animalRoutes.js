//backend -- routes/animalRoutes.js
const express = require('express');
const {
  getAnimals,
  getAnimal,
  createAnimal,
  updateAnimal,
  deleteAnimal,
  uploadAnimalPhoto,
  getAnimalVaccinations,
  getAnimalHealthEvents,
  getAnimalBreedingEvents,
  updateAnimalRestriction,
  getAnimalPedigree,
  getRestrictedAnimals,
  deleteAnimalPhoto
} = require('../controllers/animalController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getAnimals)
  .post(createAnimal);

router.route('/:id')
  .get(getAnimal)
  .put(updateAnimal)
  .delete(deleteAnimal);

router.route('/:id/photo')
 .put(upload.single('file'), uploadAnimalPhoto);

router.route('/:id/vaccinations')
  .get(getAnimalVaccinations);

router.route('/:id/health')
  .get(getAnimalHealthEvents);

router.route('/:id/breeding')
  .get(getAnimalBreedingEvents);

router.route('/:id/restriction')
  .put(updateAnimalRestriction);

router.route('/:id/pedigree')
  .get(getAnimalPedigree);
  

router.route('/restricted')
  .get(getRestrictedAnimals);

router.route('/:id/photo/:photoIndex')
  .delete(deleteAnimalPhoto);

module.exports = router;