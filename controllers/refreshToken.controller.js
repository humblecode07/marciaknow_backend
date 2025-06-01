const Admin = require('../models/admin.model');
const jwt = require('jsonwebtoken');

const handle_refresh_token = async (req, res) => {
   const cookies = req.cookies;

   if (!cookies?.jwt) {
      return res.status(401).json({
         message: 'No refresh token provided',
         code: 'NO_REFRESH_TOKEN'
      });
   }

   const refreshToken = cookies.jwt;

   const foundAdmin = await Admin.findOne({ refreshToken }).exec();
   if (!foundAdmin) {
      return res.status(403).json({
         message: 'Invalid refresh token',
         code: 'INVALID_REFRESH_TOKEN'
      });
   }

   jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
         if (err) {
            return res.status(403).json({
               message: 'Refresh token expired or invalid',
               code: 'TOKEN_VERIFICATION_FAILED'
            });
         }

         if (foundAdmin.email !== decoded.email) {
            return res.status(403).json({
               message: 'Token email mismatch',
               code: 'EMAIL_MISMATCH'
            });
         }

         const roles = Object.values(foundAdmin.roles);
         const accessToken = jwt.sign(
            {
               "email": decoded.email,
               "roles": roles
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '30s' }
         );
         res.json({ roles, accessToken })
      }
   );

}

module.exports = { handle_refresh_token }