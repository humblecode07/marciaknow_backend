const Admin = require('../models/admin.model');

const logKioskActivity = async (adminId, kioskData, action, changes = null) => {
   try {
      let logEntry = {
         kioskID: kioskData.kioskID,
         location: kioskData.location,
         dateOfChange: new Date()
      };

      console.log('gaaa')

      switch (action) {
         case 'create':
            logEntry.description = `${kioskData.name} has been added.`;
            break;

         case 'edit':
            if (changes) {
               const changesList = [];

               if (changes.name) {
                  changesList.push(`name changed from "${changes.name.old}" to "${changes.name.new}"`);
               }
               if (changes.location) {
                  changesList.push(`location changed from "${changes.location.old}" to "${changes.location.new}"`);
               }
               if (changes.coordinates) {
                  const { x, y } = changes.coordinates;
                  if (x) changesList.push(`x changed from ${x.old} to ${x.new}`);
                  if (y) changesList.push(`y changed from ${y.old} to ${y.new}`);
               }

               logEntry.description = `${kioskData.name} updated: ${changesList.join(', ')}`;
            } else {
               logEntry.description = `${kioskData.name} has been updated.`;
            }
            break;

         case 'delete':
            logEntry.description = `${kioskData.name} has been deleted.`;
            break;

         default:
            logEntry.description = `Unknown action performed on kiosk ${kioskData.kioskID}`;
            break;
      }

      console.log('📄 Log Entry:', logEntry);

      await Admin.findByIdAndUpdate(
         adminId,
         { $push: { 'systemLogs.kiosk': logEntry } },
         { new: true }
      );

      console.log(`✅ System log created: ${action} for kiosk ${kioskData.kioskID}`);
   }
   catch (error) {
      console.error('❌ Failed to log kiosk activity:', error.message);
   }
};

const logRoomActivity = async (adminId, action, roomData) => {
   try {
      // Create a more descriptive log entry
      let description;

      if (action === "Updated" && roomData.changes) {
         // Use the detailed changes summary from the controller
         description = `${action} room "${roomData.roomName || 'unnamed'}" - ${roomData.changes}`;
      } else if (action === "Created") {
         description = `${action} room "${roomData.roomName || 'unnamed'}" on floor ${roomData.floor}`;
      } else if (action === "Deleted") {
         description = `${action} room "${roomData.roomName || 'unnamed'}"`;
      } else {
         // Fallback for other actions
         description = `${action} room "${roomData.roomName || 'unnamed'}" on floor ${roomData.floor}`;
      }

      const logEntry = {
         description,
         roomId: roomData.roomId, // Include room ID for reference
         roomName: roomData.roomName,
         buildingId: roomData.buildingId,
         buildingName: roomData.buildingName,
         floor: roomData.floor,
         kioskName: roomData.kioskName,
         action: action, // Store the action type separately for filtering
         changes: roomData.changes || null, // Store raw changes for detailed tracking
         dateOfChange: new Date()
      };

      await Admin.findByIdAndUpdate(
         adminId,
         {
            $push: {
               'systemLogs.mapEditor.room': logEntry
            }
         },
         { new: true }
      );

      console.log(`System log created: ${action} for room "${roomData.roomName || 'unnamed'}" - ${roomData.changes || 'basic info'}`);
   } catch (error) {
      console.error('Failed to log room activity:', error.message);
   }
};

const logBuildingActivity = async (adminId, action, buildingData) => {
   try {
      // Create a more descriptive log entry
      let description;

      if (action === "Updated" && buildingData.changes) {
         // Use the detailed changes summary from the controller
         description = `${action} building "${buildingData.name || 'unnamed'}" - ${buildingData.changes}`;
      } else if (action === "Created") {
         description = `${action} building "${buildingData.name || 'unnamed'}" with ${buildingData.floor} floors`;
      } else if (action === "Deleted") {
         description = `${action} building "${buildingData.name || 'unnamed'}"`;
      } else {
         // Fallback for other actions
         description = `${action} building "${buildingData.name || 'unnamed'}" with ${buildingData.floor} floors`;
      }

      const logEntry = {
         description,
         buildingId: buildingData.buildingId, // Include building ID for reference
         buildingName: buildingData.name,
         floor: buildingData.floor,
         kioskName: buildingData.kioskName,
         action: action, // Store the action type separately for filtering
         changes: buildingData.changes || null, // Store raw changes for detailed tracking
         dateOfChange: new Date()
      };

      await Admin.findByIdAndUpdate(
         adminId,
         {
            $push: {
               'systemLogs.mapEditor.building': logEntry
            }
         },
         { new: true }
      );

      console.log(`System log created: ${action} for building "${buildingData.name || 'unnamed'}" - ${buildingData.changes || 'basic info'}`);
   } catch (error) {
      console.error('Failed to log building activity:', error.message);
   }
};

const getAdminLogs = async (adminId, logType = null) => {
   try {
      const admin = await Admin.findById(adminId).select('systemLogs');

      if (!admin) {
         throw new Error('Admin not found');
      }

      if (logType) {
         return admin.systemLogs[logType] || [];
      }

      return admin.systemLogs;
   } catch (error) {
      throw new Error(`Failed to retrieve logs: ${error.message}`);
   }
};

const clearOldLogs = async (adminId, daysOld = 30) => {
   try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      await Admin.findByIdAndUpdate(
         adminId,
         {
            $pull: {
               'systemLogs.kiosk': { dateOfChange: { $lt: cutoffDate } },
               'systemLogs.mapEditor.room': { dateOfChange: { $lt: cutoffDate } },
               'systemLogs.mapEditor.building': { dateOfChange: { $lt: cutoffDate } }
            }
         }
      );

      console.log(`Cleared logs older than ${daysOld} days for admin ${adminId}`);
   } catch (error) {
      console.error('Failed to clear old logs:', error.message);
   }
};

// Export all functions
module.exports = {
   logKioskActivity,
   logRoomActivity,
   logBuildingActivity,
   getAdminLogs,
   clearOldLogs
};