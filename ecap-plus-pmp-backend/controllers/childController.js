const { FlatPGConnection } = require("./../config/database");
const { parseFyWindow, buildCohortFyClause } = require("../lib/fyClause");

exports.allAssessedVCAsCount = async (req, res) => {
  try {
    const { district } = req.params;
    const window = parseFyWindow(req.query);

    const conditions = [];
    let params = [];

    // District filter (lives outside the param list — interpolated for legacy reasons).
    if (district && district !== "All") {
      const districtArray = district.split(",").map((d) => d.trim());
      conditions.push(
        `district IN (${districtArray.map((d) => `'${d.replace(/'/g, "''")}'`).join(", ")})`,
      );
    }

    // FY cohort filter (parameterised).
    const { clause, params: fyParams } = buildCohortFyClause(window, {
      startParamIndex: 1,
    });
    if (fyParams.length) params = params.concat(fyParams);

    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    const query = `SELECT COUNT(DISTINCT uid) AS count FROM children${where} ${conditions.length ? clause : clause ? " WHERE 1=1 " + clause : ""}`;

    const assessedVCAsResults = await FlatPGConnection.query(query, params);
    res
      .status(200)
      .json({ status: "success", count: assessedVCAsResults.rows[0].count });
  } catch (error) {
    console.error("Error retrieving assessed VCAs count:", error);
    res.status(500).json({
      status: "error",
      message: "An error occurred while retrieving assessed VCAs count.",
      error: error.message,
    });
  }
};

exports.getAllVCAsAssessedRegister = async (req, res) => {
  try {
    const { district } = req.params;
    const window = parseFyWindow(req.query);

    let allVcasQuery = `
      SELECT DISTINCT *
      FROM children
      WHERE LOWER(TRIM(case_status)) IN ('active','1')
        AND (reason IS NULL OR TRIM(reason) = '')
        AND de_registration_date IS NULL
    `;

    // District filter (interpolated for legacy parity).
    if (district && district !== "All") {
      const districtArray = district.split(",").map((d) => d.trim());
      allVcasQuery += ` AND district IN (${districtArray.map((d) => `'${d.replace(/'/g, "''")}'`).join(", ")})`;
    }

    // FY cohort filter (parameterised).
    const { clause, params } = buildCohortFyClause(window, {
      startParamIndex: 1,
    });
    allVcasQuery += clause;

    const allVCAResults = await FlatPGConnection.query(allVcasQuery, params);
    res.status(200).json({ status: "success", data: allVCAResults.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching VCAs.",
      error: err.message,
    });
  }
};

exports.getAllVCAsArchivedRegister = async (req, res) => {
  try {
    const { district } = req.params;
    const { reason } = req.query;
    const window = parseFyWindow(req.query);

    // FIX: Handle both 'Closed' and 'Inactive' case_status values
    let allVcasQuery = `
      SELECT DISTINCT *
      FROM children
      WHERE LOWER(TRIM(case_status)) IN ('closed', 'inactive')
        AND de_registration_date IS NOT NULL
        AND reason IS NOT NULL
        AND TRIM(reason) <> ''
    `;
    const params = [];

    if (district && district !== "All" && district !== "") {
      const districtArray = district.split(",").map((d) => d.trim());
      const placeholders = districtArray
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      allVcasQuery += ` AND district IN (${placeholders})`;
      params.push(...districtArray);
    }

    if (reason && reason !== "all") {
      params.push(reason);
      allVcasQuery += ` AND reason = $${params.length}`;
    }

    // FY cohort filter
    const fy = buildCohortFyClause(window, {
      startParamIndex: params.length + 1,
    });
    allVcasQuery += fy.clause;
    params.push(...fy.params);

    const result = await FlatPGConnection.query(allVcasQuery, params);

    res.status(200).json({
      status: "success",
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching archived VCAs.",
      error: err.message,
    });
  }
};

exports.getVcaProfile = async (req, res) => {
  const uid = req.params.uid;

  try {
    const vcaResults = await FlatPGConnection.query(
      `SELECT DISTINCT * FROM children WHERE uid = $1`,

      [uid],
    );

    const vca = vcaResults.rows[0];

    res.status(200).json({
      status: "success",
      data: vca,
    });
  } catch (err) {
    console.log(err);
  }
};

exports.getVcaServices = async (req, res) => {
  try {
    const { vcaid } = req.params;

    const allVcasQuery = `SELECT * FROM vca_services WHERE vcaid = $1`;

    const allVcaServicesResults = await FlatPGConnection.query(allVcasQuery, [
      vcaid,
    ]);

    const allVcaServices = allVcaServicesResults.rows;

    res.status(200).json({
      status: "success",
      data: allVcaServices,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching VCA services.",
      error: err.message,
    });
  }
};

exports.getAllVCAServicesByDistrict = async (req, res) => {
  try {
    const { district } = req.params;

    // Base query to count services grouped by district and month
    let query = `
      SELECT
        ah.district,
        COUNT(cs.vcaid) AS service_count,
        TO_CHAR(TO_DATE(cs.service_date, 'DD-MM-YYYY'), 'MM-YYYY') AS service_month
      FROM vca_services cs
             JOIN children ah ON cs.vcaid = ah.uid
      WHERE cs.service_date IS NOT NULL
        AND ah.district IS NOT NULL
        AND cs.vcaid IS NOT NULL
    `;
    const queryParams = [];

    // Add filtering for district if provided
    if (district && district !== "All") {
      const districtArray = district.split(",").map((d) => d.trim());
      const placeholders = districtArray
        .map((_, idx) => `$${idx + 1}`)
        .join(", ");

      query += ` AND ah.district IN (${placeholders})`;
      queryParams.push(...districtArray);
    }

    // Add grouping and ordering
    query += `
      GROUP BY ah.district, TO_CHAR(TO_DATE(cs.service_date, 'DD-MM-YYYY'), 'MM-YYYY')
      ORDER BY ah.district, service_month
    `;

    // Execute the query
    const result = await FlatPGConnection.query(query, queryParams);

    // Respond with the result
    res.status(200).json({
      status: "success",
      data: result.rows,
    });
  } catch (err) {
    console.error("Error fetching vca services:", err.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching vca services.",
      error: err.message,
    });
  }
};

// VCA services filtered by district (raw records, no aggregation)
// - Purpose: Return VCA service records for the given district(s).
// - Params: `req.params.district` can be `All`, a single district, or comma-separated list.
// - Returns: Array of records from `vca_services` with `district` appended.
// - Notes: Uses parameterized IN clause when districts are provided.
exports.getVCAServicesByDistrict = async (req, res) => {
  try {
    const { district } = req.params;

    let query = `
      SELECT cs.*, ah.district
      FROM vca_services cs
             JOIN children ah ON cs.vcaid = ah.uid
      WHERE ah.district IS NOT NULL
        AND cs.vcaid IS NOT NULL
    `;

    const queryParams = [];

    if (district && district !== "All") {
      const districtArray = district.split(",").map((d) => d.trim());
      const placeholders = districtArray
        .map((_, idx) => `$${idx + 1}`)
        .join(", ");
      query += ` AND ah.district IN (${placeholders})`;
      queryParams.push(...districtArray);
    }

    query += ` ORDER BY ah.district`;

    const result = await FlatPGConnection.query(query, queryParams);

    res.status(200).json({ status: "success", data: result.rows });
  } catch (err) {
    console.error("Error fetching VCA services by district:", err.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching VCA services by district.",
      error: err.message,
    });
  }
};

exports.getVcaCasePlans = async (req, res) => {
  try {
    const { unique_id } = req.params;

    const allVcaCasePlansQuery =
      "SELECT DISTINCT * FROM ec_vca_case_plan WHERE unique_id = $1";

    const allVcaCasePlansResult = await FlatPGConnection.query(
      allVcaCasePlansQuery,
      [unique_id],
    );

    const allVcaCasePlans = allVcaCasePlansResult.rows;

    res.status(200).json({
      status: "success",
      data: allVcaCasePlans,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message:
        "An error occurred while fetching all VCA caseplans by unique_id.",
      error: err.message,
    });
  }
};

exports.getVcaCasePlanDomains = async (req, res) => {
  try {
    const { unique_id } = req.params;
    const allVcaCasePlanDomainsQuery =
      "SELECT DISTINCT * FROM ec_vca_case_plan_domain WHERE unique_id = $1";
    const allVcaCasePlanDomainsResult = await FlatPGConnection.query(
      allVcaCasePlanDomainsQuery,
      [unique_id],
    );
    const allVcaCasePlanDomains = allVcaCasePlanDomainsResult.rows;
    res.status(200).json({
      status: "success",
      data: allVcaCasePlanDomains,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message:
        "An error occurred while fetching all VCA case plan domains by unique_id.",
      error: err.message,
    });
  }
};

exports.getAllReferrals = async (req, res) => {
  try {
    const { unique_id } = req.params;

    const allReferralsQuery =
      "SELECT * FROM all_referrals WHERE unique_id = $1";

    const allReferralsResult = await FlatPGConnection.query(allReferralsQuery, [
      unique_id,
    ]);

    const allReferrals = allReferralsResult.rows;

    res.status(200).json({
      status: "success",
      data: allReferrals,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching all referrals by unique_id",
      error: err.message,
    });
  }
};

exports.getAllVCAReferralsByDistrict = async (req, res) => {
  try {
    const { district } = req.params;

    // Base query to count referrals grouped by district and month
    let query = `
      SELECT
        ah.district,
        COUNT(cs.unique_id) AS referral_count,
        TO_CHAR(TO_DATE(cs.referred_date, 'DD-MM-YYYY'), 'MM-YYYY') AS referral_month
      FROM all_referrals cs
             JOIN children ah ON cs.unique_id = ah.uid
      WHERE cs.referred_date IS NOT NULL
        AND ah.district IS NOT NULL
        AND cs.unique_id IS NOT NULL
    `;
    const queryParams = [];

    // Add filtering for district if provided
    if (district && district !== "All") {
      const districtArray = district.split(",").map((d) => d.trim());
      const placeholders = districtArray
        .map((_, idx) => `$${idx + 1}`)
        .join(", ");

      query += ` AND ah.district IN (${placeholders})`;
      queryParams.push(...districtArray);
    }

    // Add grouping and ordering
    query += `
      GROUP BY ah.district, TO_CHAR(TO_DATE(cs.referred_date, 'DD-MM-YYYY'), 'MM-YYYY')
      ORDER BY ah.district, referral_month
    `;

    // Execute the query
    const result = await FlatPGConnection.query(query, queryParams);

    // Respond with the result
    res.status(200).json({
      status: "success",
      data: result.rows,
    });
  } catch (err) {
    console.error("Error fetching vca services:", err.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching vca services.",
      error: err.message,
    });
  }
};
