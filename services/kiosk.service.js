exports.generateKioskId = () => {
   const randomDigits = Math.floor(100 + Math.random() * 900); 
   const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
   const randomNum1 = Math.floor(Math.random() * 10); 
   const randomNum2 = Math.floor(Math.random() * 10); 

   return `K${randomDigits}${randomLetter}${randomNum1}Y${randomNum2}`;
};