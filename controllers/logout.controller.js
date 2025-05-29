const Admin = require('../models/admin.model');

const handle_logout = async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(204);
    const refreshToken = cookies.jwt;

    const foundAdmin = await Admin.findOne({ refreshToken }).exec();
    if (!foundAdmin) {
        res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
        return res.sendStatus(204);
    }

    foundAdmin.refreshToken = '';
    const result = await foundAdmin.save();
    console.log(result);

    res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
    res.sendStatus(204);
}

module.exports = { handle_logout }