//backend -- routes/animalBreedRoutes.js
const express = require('express');
const {
  getBreeds,
  getBreed,
  createBreed,
  updateBreed,
  deleteBreed,
  getCategoryBreeds
} = require('../controllers/animalBreedController');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });


// وسيط خاص للتعامل مع طلبات DELETE
const handleDeleteRequest = (req, res, next) => {
  // تأكد من أن req.body موجود دائمًا لطلبات DELETE
  if (req.method === 'DELETE') {
    req.body = req.body || {};
  }
  next();
};


router.use(protect);

router.route('/')
  .get(getBreeds)
  .post(createBreed);

router.route('/:id')
  .get(getBreed)
  .put(updateBreed)
.delete(handleDeleteRequest, deleteBreed);

// سلالات فئة معينة
router.get('/category/:categoryId', getCategoryBreeds);

module.exports = router;