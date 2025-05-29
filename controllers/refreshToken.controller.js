const Admin = require('../models/admin.model');
const jwt = require('jsonwebtoken');

const handle_refresh_token = async (req, res) => {
   const cookies = req.cookies;
   if (!cookies?.jwt) return res.sendStatus(401);
   const refreshToken = cookies.jwt;

   const foundAdmin = await Admin.findOne({ refreshToken }).exec();
   if (!foundAdmin) return res.sendStatus(403); //Forbidden 
   // evaluate jwt 
   jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
         if (err || foundAdmin.email !== decoded.email) return res.sendStatus(403);
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