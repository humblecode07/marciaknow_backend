const mongoose = require('mongoose');
const Kiosk = require('../models/kiosk.model');

exports.generateKioskId = () => {
   const randomDigits = Math.floor(100 + Math.random() * 900);
   const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
   const randomNum1 = Math.floor(Math.random() * 10);
   const randomNum2 = Math.floor(Math.random() * 10);

   return `K${randomDigits}${randomLetter}${randomNum1}Y${randomNum2}`;
};

exports.markOfflineKiosks = async () => {
   const FIVE_MINUTES = 5 * 60 * 1000;
   const now = new Date();

   try {
      const kiosks = await Kiosk.find();

      for (let kiosk of kiosks) {
         const lastSeen = new Date(kiosk.lastCheckIn);
         const diff = now - lastSeen;

         if (diff > FIVE_MINUTES && kiosk.status !== 'offline') {
            kiosk.status = 'offline';
            await kiosk.save();
            console.log(`Kiosk ${kiosk.kioskID} marked as offline.`);
         }
      }
   } catch (err) {
      console.error('Error checking kiosk statuses:', err.message);
   }
};