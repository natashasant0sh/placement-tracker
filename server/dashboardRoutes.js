const express = require('express');
const router = express.Router();

router.get('/student', (req, res) => {
    res.send('Student Dashboard');
  });
  
  router.get('/placement-officer', (req, res) => {
    res.send('Placement Officer Dashboard');
  });
  
  module.exports = router;