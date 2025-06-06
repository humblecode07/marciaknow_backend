const Admin = require('../models/admin.model');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const asyncHandler = require('express-async-handler');

exports.log_in = asyncHandler(async (req, res, next) => {
   const { email, password } = req.body;

   if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
   }

   const foundAdmin = await Admin.findOne({ email }).exec();
   if (!foundAdmin) {
      return res.status(401).json({ message: 'Invalid email or password.' });
   }

   if (foundAdmin.isDisabled) {
      return res.status(403).json({ message: 'Your account has been disabled. Contact a Super Admin.' });
   }

   const match = await bcrypt.compare(password, foundAdmin.password);
   if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
   }

   if (!process.env.REFRESH_TOKEN_SECRET || !process.env.ACCESS_TOKEN_SECRET) {
      console.error('REFRESH_TOKEN_SECRET is not defined');
      return res.status(500).json({ message: 'Server configuration error' });
   }

   const roles = foundAdmin.roles.filter(Boolean);

   const accessToken = jwt.sign(
      {
         email: foundAdmin.email,
         roles: roles,
         adminId: foundAdmin._id
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
   );

   const refreshToken = jwt.sign(
      {
         email: foundAdmin.email,
         roles: roles,
         adminId: foundAdmin._id
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '1d' }
   );

   foundAdmin.refreshToken = refreshToken;
   foundAdmin.lastLogin = new Date;

   await foundAdmin.save();

   res.cookie('jwt', refreshToken, { httpOnly: true, secure: true, sameSite: 'None', maxAge: 24 * 60 * 60 * 1000 });

   res.status(200).json({
      message: 'Authentication successful.',
      accessToken: accessToken,
      refreshToken: refreshToken
   });
});