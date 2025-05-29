require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/dbConn");
const createError = require('http-errors');
const cors = require("cors");
const cookieParser = require('cookie-parser');
require('./services/kiosk.monitor');

// Routers
const buildingRouter = require("./routers/building.router");
const roomRouter = require("./routers/room.router");
const kioskRouter = require("./routers/kiosk.router");
const imageRouter = require('./routers/image.router');
const iconRouter = require('./routers/navigationIcon.router');
const groqRouter = require('./routers/groq.router');
const adminsRouter = require('./routers/admin.router');
const authRouter = require('./routers/auth.router');
const refreshTokenRouter = require('./routers/refreshToken.router');
const logoutRouter = require('./routers/logout.router');

const app = express();

const PORT = process.env.PORT || 3000;
connectDB();

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(cookieParser());

app.use("/building", buildingRouter);
app.use("/room", roomRouter);
app.use("/kiosk", kioskRouter);
app.use("/image", imageRouter);
app.use("/icon", iconRouter);
app.use("/groq", groqRouter);
app.use("/admin", adminsRouter);
app.use("/auth", authRouter);
app.use("/refresh", refreshTokenRouter);
app.use("/logout", logoutRouter);

// Catch 404 and forward to error handler
app.use((req, res, next) => {
    next(createError(404));
})

// Error handler
app.use((err, req, res, next) => {
    // Set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // Render the error page
    res.status(err.status || 500);
    res.json({
        error: {
            message: res.locals.message,
            error: res.locals.error
        }
    });
});

app.get("/", (req, res) => {
    res.send("Backend is running!");
});

// Connection event listener
mongoose.connection.once('open', () => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
});