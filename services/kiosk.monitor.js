const { markOfflineKiosks } = require('./kiosk.service');

// Run every minute
setInterval(markOfflineKiosks, 60 * 1000);