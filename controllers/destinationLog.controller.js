const DestinationLog = require('../models/destinationLog.model');
const Building = require('../models/building.model');
const { default: mongoose } = require('mongoose');

const getRecentDestinationSearch = async (req, res) => {
   try {
      const recentDestinationsLogs = await DestinationLog.find().sort({ createdAt: -1 }).limit(10);

      res.json(recentDestinationsLogs);
   }
   catch (error) {
      throw new Error('Unexpected error precedented: ' + error.message);
   }
}

const logDestinationSearch = async (req, res) => {
   try {
      const { buildingId, roomId, searchQuery, destinationType, kioskId } = req.body;

      const destinationLog = new DestinationLog({
         buildingId,
         roomId,
         searchQuery,
         destinationType,
         kioskId,
         sessionId: req.sessionID || null,
      });

      await destinationLog.save();

      res.status(201).json({
         success: true,
         message: 'Destination search logged successfully',
         logId: destinationLog._id,
      });

   } catch (error) {
      console.error('Error logging destination search:', error);
      res.status(500).json({
         success: false,
         message: 'Failed to log destination search',
         error: error.message,
      });
   }
};

const getMostFrequentDestinations = async (req, res) => {
   try {
      const { timeframe = 'month' } = req.query;

      const now = new Date();
      let startDate;

      switch (timeframe) {
         case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
         case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
         case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
         default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const frequentDestinations = await DestinationLog.aggregate([
         {
            $match: {
               timestamp: { $gte: startDate }
            }
         },
         {
            $group: {
               _id: {
                  buildingId: '$buildingId',
                  roomId: '$roomId',
                  destinationType: '$destinationType',
               },
               count: { $sum: 1 },
               lastAccessed: { $max: '$timestamp' },
               searchQueries: { $addToSet: '$searchQuery' },
               kioskId: { $first: '$kioskId' }
            }
         },
         {
            $sort: { count: -1 }
         },
         {
            $limit: 20
         }
      ]);

      const populatedResults = await Promise.all(
         frequentDestinations.map(async (dest) => {
            let buildingName = 'Unknown Building';
            let roomName = null;

            console.log('dest', dest);

            try {
               // Find building by the auto-incremented 'id' field, not '_id'
               let building;
               const buildingId = dest._id.buildingId; // FIX: Use dest._id.buildingId

               if (mongoose.Types.ObjectId.isValid(buildingId) && buildingId.length === 24) {
                  // It's an ObjectId, query by _id
                  building = await Building.findById(buildingId);
               } else {
                  // It's a numeric ID, query by id field
                  building = await Building.findOne({ id: parseInt(buildingId) });
               }

               if (building) {
                  buildingName = building.name;

                  if (dest._id.roomId) {
                     // Handle room lookup - also need to check if roomId is ObjectId or numeric
                     const roomId = dest._id.roomId;

                     if (mongoose.Types.ObjectId.isValid(roomId) && roomId.length === 24) {
                        // ObjectId room - search through existingRoom Map
                        for (const [floor, rooms] of building.existingRoom) {
                           const room = rooms.find(r => r._id.toString() === roomId);
                           if (room) {
                              roomName = room.name;
                              break;
                           }
                        }
                     } else {
                        // Numeric room ID - search by id field
                        for (const [floor, rooms] of building.existingRoom) {
                           const room = rooms.find(r => r.id === parseInt(roomId));
                           if (room) {
                              roomName = room.name;
                              break;
                           }
                        }
                     }
                  }
               }
            } catch (error) {
               console.error('Error populating destination details:', error);
            }

            return {
               buildingId: dest._id.buildingId,
               roomId: dest._id.roomId,
               destinationType: dest._id.destinationType,
               buildingName,
               roomName,
               count: dest.count,
               lastAccessed: dest.lastAccessed,
               searchQueries: dest.searchQueries,
               timestamp: dest.timestamp,
               kioskId: dest.kioskId
            };
         })
      );

      res.json({
         success: true,
         timeframe,
         period: {
            startDate: startDate.toISOString(),
            endDate: now.toISOString()
         },
         destinations: populatedResults,
         totalLogs: await DestinationLog.countDocuments({
            timestamp: { $gte: startDate }
         })
      });

   } catch (error) {
      console.error('Error fetching frequent destinations:', error);
      res.status(500).json({
         success: false,
         message: 'Failed to fetch frequent destinations',
         error: error.message,
      });
   }
};

const getDailySearchActivity = async (req, res) => {
   try {
      const { timeframe = 'week' } = req.query;

      const now = new Date();
      let startDate;

      switch (timeframe) {
         case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
         case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
         case 'year':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
         default:
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const dailySearches = await DestinationLog.aggregate([
         {
            $match: {
               timestamp: { $gte: startDate }
            }
         },
         {
            $group: {
               _id: {
                  $dateToString: {
                     format: "%Y-%m-%d",
                     date: "$timestamp"
                  }
               },
               searches: { $sum: 1 },
               date: { $first: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } } }
            }
         },
         {
            $sort: { "_id": 1 }
         }
      ]);

      res.json({
         success: true,
         timeframe,
         data: dailySearches.map(day => ({
            date: day._id,
            searches: day.searches
         }))
      });

   } catch (error) {
      console.error('Error fetching daily search activity:', error);
      res.status(500).json({
         success: false,
         message: 'Failed to fetch daily search activity',
         error: error.message,
      });
   }
};

module.exports = {
   logDestinationSearch,
   getMostFrequentDestinations,
   getDailySearchActivity,
   getRecentDestinationSearch
};