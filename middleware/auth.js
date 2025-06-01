const jwt = require('jsonwebtoken');
const Admin = require('../models/admin.model');
const asyncHandler = require('express-async-handler');

const authenticateToken = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        console.log('❌ No token found in header or cookie');
        return res.status(401).json({
            message: 'Not authorized, no token',
            debug: 'Token missing from both header and cookie'
        });
    }
    try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        req.user = await Admin.findById(decoded.adminId).select('-password');

        if (!req.user) {
            console.log('ERROR: Admin not found in DB');
            return res.status(401).json({
                message: 'Not authorized, admin not found',
                debug: 'Decoded token valid but admin ID not in DB'
            });
        }

        next();
    } catch (error) {
        let errorMessage = 'Not authorized, token failed';
        if (error.name === 'JsonWebTokenError') {
            errorMessage = 'Invalid token format';
        } 
        else if (error.name === 'TokenExpiredError') {
            errorMessage = 'Token has expired';
        }
        return res.status(401).json({
            message: errorMessage,
            debug: error.message
        });
    }
});

module.exports = { authenticateToken };
