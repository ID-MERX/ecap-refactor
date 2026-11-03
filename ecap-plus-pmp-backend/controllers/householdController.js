const { FlatPGConnection } = require("./../config/database");
const { parseFyWindow, buildCohortFyClause } = require("../lib/fyClause");

exports.allAssessedHouseholdsCount = async (req, res) => {
  try {
    const { district } = req.params;
    const window = parseFyWindow(req.query);

    const conditions = [];
    let params = [];

    if (district && district !== "All") {
      const districtArray = district.split(",").map((d) => d.trim());
      conditions.push(
        `district IN (${districtArray.map((d) => `'${d.replace(/'/g, "''")}'`).join(", ")})`,
      );
    }

    const { clause, params: fyParams } = buildCohortFyClause(window, {
      startParamIndex: 1,
    });
    if (fyParams.length) params = params.concat(fyParams);

    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    const query = `SELECT COUNT(DISTINCT household_id) AS count FROM all_households${where} ${conditions.length ? clause : clause ? " WHERE 1=1 " + clause : ""}`;

    const result = await FlatPGConnection.query(query, params);
    res.status(200).json({ status: "success", count: result.rows[0].count });
  } catch (error) {
    console.error("Error retrieving assessed households count:", error);
    res.status(500).json({
      status: "error",
      message: "An error occurred while retrieving assessed households count.",
      error: error.message,
    });
  }
};

exports.getAllHouseholds = async (req, res) => {
  try {
    const { district } = req.params;
    const window = parseFyWindow(req.query);
    const filters = [
      {
        key: "de_registration_reason",
        value: req.query.de_registration_reason,
      },
    ];

    const queryParams = [];

    let allHouseholdsQuery = `
      SELECT DISTINCT *
      FROM all_households
      WHERE LOWER(TRIM(case_status)) IN ('active','1')
        AND de_registration_date IS NULL
        AND (de_registration_reason IS NULL OR TRIM(de_registration_reason) = '')
    `;

    if (district && district !== "All") {
      const districtArray = district.split(",").map((d) => d.trim());
      const districtList = districtArray
        .map((d) => `'${d.replace(/'/g, "''")}'`)
        .join(", ");
      allHouseholdsQuery += ` AND district IN (${districtList})`;
    }

    filters.forEach((filter) => {
      if (filter.value) {
        queryParams.push(filter.value);
        allHouseholdsQuery += ` AND ${filter.key} = $${queryParams.length}`;
      }
    });

    // FY cohort filter
    const fy = buildCohortFyClause(window, {
      startParamIndex: queryParams.length + 1,
    });
    allHouseholdsQuery += fy.clause;
    queryParams.push(...fy.params);

    const allHouseholdsResult = await FlatPGConnection.query(
      allHouseholdsQuery,
      queryParams,
    );
    const allHouseholds = allHouseholdsResult.rows;

    // Send the result in the response
    res.status(200).json({
      status: "success",
      data: allHouseholds,
    });
  } catch (err) {
    // Error handling
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching households.",
      error: err.message,
    });
  }
};

exports.getAllArchivedHouseholds = async (req, res) => {
  try {
    const { district } = req.params;
    const reason = req.query.reason ?? req.query.de_registration_reason;
    const window = parseFyWindow(req.query);

    let allHouseholdsQuery = `
      SELECT DISTINCT *
      FROM all_households
      WHERE LOWER(TRIM(case_status)) = 'closed'
        AND de_registration_date IS NOT NULL
        AND de_registration_reason IS NOT NULL
    `;
    const params = [];

    if (district && district !== "All" && district !== "") {
      const districtArray = district.split(",").map((d) => d.trim());
      const placeholders = districtArray
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      allHouseholdsQuery += ` AND district IN (${placeholders})`;
      params.push(...districtArray);
    }

    if (reason && reason !== "all") {
      params.push(reason);
      allHouseholdsQuery += ` AND de_registration_reason = $${params.length}`;
    }

    // FY cohort filter
    const fy = buildCohortFyClause(window, {
      startParamIndex: params.length + 1,
    });
    allHouseholdsQuery += fy.clause;
    params.push(...fy.params);

    const result = await FlatPGConnection.query(allHouseholdsQuery, params);

    res.status(200).json({
      status: "success",
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching archived households.",
      error: err.message,
    });
  }
};

exports.getAllHouseholdMemberRegister = async (req, res) => {
  try {
    const allChildrenQuery = "SELECT * FROM children";

    const allChildrenResult = await FlatPGConnection.query(allChildrenQuery);

    const allHouseholds = allChildrenResult.rows;

    res.status(200).json({
      status: "success",
      data: allHouseholds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching all households.",
      error: err.message,
    });
  }
};

exports.getAllCaregiverServices = async (req, res) => {
  try {
    const { household_id } = req.params;

    const allCaregiverServicesQuery =
      "SELECT * FROM caregiver_services WHERE household_id = $1";

    const allCaregiverResult = await FlatPGConnection.query(
      allCaregiverServicesQuery,
      [household_id],
    );

    const allCaregiverServices = allCaregiverResult.rows;

    res.status(200).json({
      status: "success",
      data: allCaregiverServices,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message:
        "An error occurred while fetching caregiver services by household_id",
      error: err.message,
    });
  }
};

exports.getAllCaregiverServicesByDistrict = async (req, res) => {
  try {
    const { district } = req.params;

    // Base query to count services grouped by district and month
    let query = `
      SELECT
        ah.district,
        COUNT(cs.household_id) AS service_count,
        TO_CHAR(TO_DATE(cs.service_date, 'DD-MM-YYYY'), 'MM-YYYY') AS service_month
      FROM caregiver_services cs
             JOIN all_households ah ON cs.household_id = ah.household_id
      WHERE cs.service_date IS NOT NULL
        AND ah.district IS NOT NULL
        AND cs.household_id IS NOT NULL
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
    console.error("Error fetching caregiver services:", err.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching caregiver services.",
      error: err.message,
    });
  }
};

// Caregiver services filtered by district (raw records, no aggregation)
// - Purpose: Return caregiver service records for the given district(s).
// - Params: `req.params.district` can be `All`, a single district, or comma-separated list.
// - Returns: Array of records from `caregiver_services` with `district` appended.
// - Notes: Uses parameterized IN clause when districts are provided.
exports.getCaregiverServicesByDistrict = async (req, res) => {
  try {
    const { district } = req.params;

    let query = `
      SELECT cs.*, ah.district
      FROM caregiver_services cs
             JOIN all_households ah ON cs.household_id = ah.household_id
      WHERE ah.district IS NOT NULL
        AND cs.household_id IS NOT NULL
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
    console.error(
      "Error fetching caregiver services by district:",
      err.message,
    );
    res.status(500).json({
      status: "error",
      message:
        "An error occurred while fetching caregiver services by district.",
      error: err.message,
    });
  }
};

exports.getAllCaregiverReferralsByDistrict = async (req, res) => {
  try {
    const { district } = req.params;

    // Base query to count services grouped by district and month
    let query = `
      SELECT
        ah.district,
        COUNT(cs.household_id) AS referral_count,
        TO_CHAR(TO_DATE(cs.referred_date, 'DD-MM-YYYY'), 'MM-YYYY') AS referral_month
      FROM all_referrals cs
             JOIN all_households ah ON cs.household_id = ah.household_id
      WHERE cs.referred_date IS NOT NULL
        AND ah.district IS NOT NULL
        AND cs.household_id IS NOT NULL
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
    console.error("Error fetching caregiver services:", err.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching caregiver services.",
      error: err.message,
    });
  }
};

// Household services filtered by district (raw records, no aggregation)
// - Purpose: Return household service records for the given district(s).
// - Params: `req.params.district` can be `All`, a single district, or comma-separated list.
// - Returns: Array of records from `household_services` with `district` appended.
// - Notes: Joins `household_services` to `all_households` on household_id.
exports.getHouseholdServicesByDistrict = async (req, res) => {
  try {
    const { district } = req.params;

    let query = `
      SELECT hs.*, ah.district
      FROM household_services hs
             JOIN all_households ah ON hs.household_id = ah.household_id
      WHERE ah.district IS NOT NULL
        AND hs.household_id IS NOT NULL
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

    res.status(200).json({
      status: "success",
      data: result.rows,
    });
  } catch (err) {
    console.error(
      "Error fetching household services by district:",
      err.message,
    );
    res.status(500).json({
      status: "error",
      message:
        "An error occurred while fetching household services by district.",
      error: err.message,
    });
  }
};

// HTS register by district.
// - Purpose: Return HTS register records scoped to a single district. The
//   frontend HtsRegister page fans out one request per district when
//   "All Districts" is selected, so server-side district filtering is what
//   makes the district picker actually work.
// - If no district passed (or the literal "All Districts" placeholder), return
//   everything. Otherwise filter case-insensitively against trimmed district
//   values so small whitespace differences don't drop rows.
exports.getHTSRegisterByDistrict = async (req, res) => {
  try {
    const district = String(req.params.district || "").trim();
    let result;
    if (!district || district.toLowerCase() === "all districts") {
      result = await FlatPGConnection.query(
        "SELECT * FROM public.hts_register",
      );
    } else {
      result = await FlatPGConnection.query(
        "SELECT * FROM public.hts_register WHERE LOWER(TRIM(district)) = LOWER($1)",
        [district],
      );
    }
    res.status(200).json({ status: "success", data: result.rows });
  } catch (err) {
    console.error("Error fetching HTS register by district:", err.message);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching HTS register.",
      error: err.message,
    });
  }
};

exports.getAllReferrals = async (req, res) => {
  try {
    const { household_id } = req.params;

    const allReferralsQuery =
      "SELECT * FROM all_referrals WHERE household_id = $1";

    const allReferralsResult = await FlatPGConnection.query(allReferralsQuery, [
      household_id,
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
      message: "An error occurred while fetching all referrals by household_id",
      error: err.message,
    });
  }
};

exports.getAllCaregiverCasePlans = async (req, res) => {
  try {
    const { household_id } = req.params;

    const allCaregiverCasePlansQuery =
      "SELECT * FROM ec_caregiver_case_plan WHERE household_id = $1";

    const allCaregiverCasePlansResult = await FlatPGConnection.query(
      allCaregiverCasePlansQuery,
      [household_id],
    );

    const allCaregiverCasePlans = allCaregiverCasePlansResult.rows;

    res.status(200).json({
      status: "success",
      data: allCaregiverCasePlans,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message:
        "An error occurred while fetching all caregiver caseplans by household_id.",
      error: err.message,
    });
  }
};

exports.getAllCaregiverCasePlanDomains = async (req, res) => {
  try {
    const { household_id } = req.params;
    const allCaregiverCasePlanDomainsQuery =
      "SELECT DISTINCT * FROM ec_caregiver_case_plan_domain WHERE household_id = $1";
    const allCaregiverCasePlanDomainsResult = await FlatPGConnection.query(
      allCaregiverCasePlanDomainsQuery,
      [household_id],
    );
    const allCaregiverCasePlanDomains = allCaregiverCasePlanDomainsResult.rows;
    res.status(200).json({
      status: "success",
      data: allCaregiverCasePlanDomains,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: "error",
      message:
        "An error occurred while fetching all caregiver case plan domains by household_id.",
      error: err.message,
    });
  }
};

exports.getHouseholdFamilyMembers = async (req, res) => {
  const household_id = req.params.household_id;

  try {
    const familyMembersResult = await FlatPGConnection.query(
      `SELECT DISTINCT * FROM children WHERE household_id = $1`,
      [household_id],
    );

    const familyMembers = familyMembersResult.rows;

    res.status(200).json({
      status: "success for a single household family members",
      data: familyMembers,
    });
  } catch (error) {
    res.status(500).json({
      status: "error occurred, NO family members found for this household",
      message: error.message,
    });
  }
};

// External ECAP II extract endpoints removed.
// ECAP Plus external extract endpoints removed.

// HTS external extract endpoints removed.
// VCA caseplans external extract endpoints removed.
