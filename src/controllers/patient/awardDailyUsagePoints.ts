import { asyncHandler, requirePatientId } from '../../utils/helpers';
import { awardPatientPointsForEvent } from '../../services/patientPoints.service';

export const awardDailyUsagePoints = asyncHandler(
  'Failed to award daily usage points',
  async (req, res) => {
    const patientId = requirePatientId(req);

    const result = await awardPatientPointsForEvent({
      patientId,
      eventType: 'daily_app_usage',
    });

    return res.status(200).json({
      success: true,
      message:
        result.awardedPoints > 0
          ? 'Daily usage points awarded'
          : result.alreadyAwarded
            ? 'Daily usage points already awarded today'
            : 'Daily points cap reached',
      data: result,
    });
  },
);
