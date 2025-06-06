require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/dbConn");
const createError = require('http-errors');
const cors = require("cors");
const cookieParser = require('cookie-parser');
// require('./services/kiosk.monitor');

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
const qrScanLogRouter = require('./routers/qrScanLog.router');
const destinationLogRoutes = require('./routers/destinationLog.router');
const chatbotRoutes = require('./routers/chatbot.router');
const feedbackRoutes = require('./routers/feedback.router');

const app = express();

const PORT = process.env.PORT || 3000;
connectDB();

const allowedOrigins = [
    'http://localhost:5173',
    'https://marcia-know.vercel.app'
];

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) { // !origin allows requests from same origin (e.g., Postman, curl, or if you deploy frontend and backend on the same base domain)
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionSuccessStatus: 200
};

app.use(cors(corsOptions));
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
app.use("/qrscan", qrScanLogRouter);
app.use("/destinationlog", destinationLogRoutes);
app.use('/chatbot', chatbotRoutes);
app.use('/feedback', feedbackRoutes);

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