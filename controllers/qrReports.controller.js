const QrScanLog = require('../models/qrScanLog.model')

const logQrScan = async (req, res) => {
  try {
    const { buildingId, kioskId } = req.params;
    const { buildingName } = req.body;

    if (!buildingId || !kioskId) {
      return res.status(400).json({
        success: false,
        message: 'Building ID and Kiosk ID are required'
      });
    }

    // Create scan log entry
    const scanLog = new QrScanLog({
      buildingId: buildingId,
      buildingName: buildingName || 'Unknown Building',
      kioskId: kioskId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      referrer: req.get('Referer'),
      sessionId: req.sessionID
    });

    await scanLog.save();

    res.status(201).json({
      success: true,
      message: 'QR scan logged successfully',
      data: {
        scanId: scanLog._id,
        scannedAt: scanLog.scannedAt,
        buildingName: scanLog.buildingName,
        kioskId: scanLog.kioskId
      }
    });

  } catch (error) {
    console.error('QR Scan Logging Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log QR scan',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get daily scan report
const getDailyScanReport = async (req, res) => {
  try {
    const { startDate, endDate, kioskId, buildingId } = req.query;

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Set end date to end of day
    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);

    const filters = {};
    if (kioskId) filters.kioskId = kioskId;
    if (buildingId) filters.buildingId = buildingId;

    const dailyCounts = await QrScanLog.getDailyScanCounts(start, end, filters);

    // Fill in missing dates with 0 counts
    const filledData = [];
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dateString = currentDate.toISOString().split('T')[0];
      const existingData = dailyCounts.find(item => item.reportDate === dateString);
      
      filledData.push({
        reportDate: dateString,
        totalScans: existingData ? existingData.totalScans : 0
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.status(200).json({
      success: true,
      data: filledData.reverse(), // Most recent first
      summary: {
        totalDays: filledData.length,
        totalScans: filledData.reduce((sum, day) => sum + day.totalScans, 0),
        averagePerDay: Math.round(filledData.reduce((sum, day) => sum + day.totalScans, 0) / filledData.length * 100) / 100,
        filters: filters
      }
    });

  } catch (error) {
    console.error('Daily Scan Report Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily scan report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get total scan count
const getTotalScanCount = async (req, res) => {
  try {
    const { kioskId, buildingId } = req.query;
    
    const filters = {};
    if (kioskId) filters.kioskId = kioskId;
    if (buildingId) filters.buildingId = buildingId;
    
    const totalCount = await QrScanLog.getTotalScanCount(filters);

    res.status(200).json({
      success: true,
      data: {
        totalScans: totalCount,
        filters: filters
      }
    });

  } catch (error) {
    console.error('Total Scan Count Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch total scan count',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get recent scan logs
const getRecentScanLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, kioskId, buildingId } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (kioskId) query.kioskId = kioskId;
    if (buildingId) query.buildingId = buildingId;

    const logs = await QrScanLog.find(query)
      .sort({ scannedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-userAgent -ipAddress') // Exclude sensitive data
      .lean();

    const totalLogs = await QrScanLog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalLogs / limit),
          totalLogs,
          hasMore: skip + logs.length < totalLogs
        }
      }
    });

  } catch (error) {
    console.error('Recent Scan Logs Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent scan logs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get building and kiosk statistics
const getBuildingKioskStats = async (req, res) => {
  try {
    const stats = await QrScanLog.aggregate([
      {
        $group: {
          _id: {
            buildingId: '$buildingId',
            buildingName: '$buildingName',
            kioskId: '$kioskId'
          },
          totalScans: { $sum: 1 },
          lastScan: { $max: '$scannedAt' },
          firstScan: { $min: '$scannedAt' }
        }
      },
      {
        $group: {
          _id: {
            buildingId: '$_id.buildingId',
            buildingName: '$_id.buildingName'
          },
          totalScans: { $sum: '$totalScans' },
          kioskCount: { $sum: 1 },
          lastActivity: { $max: '$lastScan' },
          firstActivity: { $min: '$firstScan' },
          kiosks: {
            $push: {
              kioskId: '$_id.kioskId',
              totalScans: '$totalScans',
              lastScan: '$lastScan',
              firstScan: '$firstScan'
            }
          }
        }
      },
      {
        $project: {
          buildingId: '$_id.buildingId',
          buildingName: '$_id.buildingName',
          totalScans: 1,
          kioskCount: 1,
          lastActivity: 1,
          firstActivity: 1,
          kiosks: 1,
          _id: 0
        }
      },
      { $sort: { totalScans: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Building Kiosk Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch building and kiosk statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  logQrScan,
  getDailyScanReport,
  getTotalScanCount,
  getRecentScanLogs,
  getBuildingKioskStats
};