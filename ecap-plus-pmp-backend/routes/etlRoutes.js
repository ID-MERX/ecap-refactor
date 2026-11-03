const express = require("express");
const router = express.Router();
const etlController = require("../controllers/etlController");

// GET /etl/last-success - Returns timestamp of last successful Mage AI run.
// Polled by the frontend every ~30s to invalidate caches after fresh data.
router.get("/last-success", etlController.getLastSuccessfulEtlRun);

router.post("/run", etlController.triggerRun);
router.get("/runs", etlController.getRuns);
router.get("/runs/:runId", etlController.getRunById);
router.post("/cancel/:runId", etlController.cancelRun);
router.get("/pipelines", etlController.getPipelines);
router.get("/files/:pipeline", etlController.getFiles);
router.post("/send-report", etlController.sendReport);
router.get("/download/:pipeline/:fileName", etlController.downloadFile);

// GET /etl/tablet-sync/stream - Stream tablet/provider sync status
router.get("/tablet-sync/stream", etlController.streamTabletSyncStatus);

// POST /etl/tablet-sync/notify - Webhook receiver for tablet-sync refreshes
router.post("/tablet-sync/notify", etlController.notifyTabletSyncStatus);

// GET /etl/tablet-sync - Get tablet/provider sync status
router.get("/tablet-sync", etlController.getTabletSyncStatus);

// GET /etl/facility-performance - Get facility-level VCA and household counts
router.get("/facility-performance", etlController.getFacilityPerformance);

// GET /etl/caseworker-journeys - Get caseworker GPS journey data
router.get("/caseworker-journeys", etlController.getCaseworkerJourneys);

// GET /etl/caseworker-list - Get distinct caseworker list
router.get("/caseworker-list", etlController.getCaseworkerList);
router.get("/facility-list", etlController.getFacilityList);
router.get("/duplicates", etlController.getDuplicates);
router.get("/dqa-checks", etlController.getDqaChecks);
router.get("/dqa-records", etlController.getDqaRecords);

// GET /etl/action-queue - Priority actionable items per service page
router.get("/action-queue", etlController.getActionQueue);

// GET /etl/services/:type/summary - DB-backed canonical KPIs
router.get("/services/:type/summary", etlController.getServiceSummary);

// GET /etl/services/:type/timeseries - 12-month service volume
router.get("/services/:type/timeseries", etlController.getServiceTimeseries);

// GET /etl/services/:type/distribution - Pillar mix over last 90 days
router.get(
  "/services/:type/distribution",
  etlController.getServiceDistribution,
);

// GET /etl/services/:type/records - Paginated, filtered, server-side records
router.get("/services/:type/records", etlController.getServiceRecords);

// GET /etl/services/:type/record-detail - Full raw payload for one entity
router.get(
  "/services/:type/record-detail",
  etlController.getServiceRecordDetail,
);

// GET /etl/services/:type/export - Full filtered CSV download (streamed)
router.get("/services/:type/export", etlController.exportServiceRecords);

// GET /etl/caseworker-performance
router.get("/caseworker-performance", etlController.getCaseworkerPerformance);

// GET /etl/service-performance
router.get("/service-performance", etlController.getServicePerformance);

// Duplicate review persistence
router.get("/duplicates/reviews", etlController.listDuplicateReviews);
router.post("/duplicates/review", etlController.upsertDuplicateReview);
router.delete(
  "/duplicates/review/:run_key",
  etlController.deleteDuplicateReview,
);

// GET /etl/pmtct-child-register/:district - PMTCT child register rows
router.get(
  "/pmtct-child-register/:district(*)",
  etlController.getPmtctChildRegisterByDistrict,
);

// GET /etl/pmtct-mother-register/:district - PMTCT mother register rows
router.get(
  "/pmtct-mother-register/:district(*)",
  etlController.getPmtctMotherRegisterByDistrict,
);

module.exports = router;
