const { FlatPGConnection } = require("./../config/database");

const buildDistrictWhere = (district) => {
  const trimmed = String(district || "").trim();
  if (!trimmed || trimmed.toLowerCase() === "all districts" || trimmed.toLowerCase() === "all") {
    return { clause: "", params: [] };
  }
  return {
    clause: "AND LOWER(TRIM(district)) = LOWER(TRIM($1))",
    params: [trimmed],
  };
};

exports.getMothersByDistrict = async (req, res) => {
  const district = req.params.district;
  try {
    const { clause, params } = buildDistrictWhere(district);
    const query = `
      SELECT *
      FROM mothers
      WHERE 1 = 1
        ${clause}
      ORDER BY household_id ASC
    `;
    const result = await FlatPGConnection.query(query, params);
    return res.status(200).json({ status: "success", data: result.rows });
  } catch (error) {
    console.error("Failed to get mothers by district:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

exports.getTotalMothersCount = async (req, res) => {
  try {
    const result = await FlatPGConnection.query(`
      SELECT COUNT(DISTINCT household_id)::int AS count
      FROM mothers
    `);
    return res.status(200).json({ status: "success", count: result.rows[0]?.count ?? 0 });
  } catch (error) {
    console.error("Failed to get total mothers count:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

exports.getMothersCountByDistrict = async (req, res) => {
  const district = req.params.district;
  try {
    const { clause, params } = buildDistrictWhere(district);
    const result = await FlatPGConnection.query(
      `
      SELECT COUNT(DISTINCT household_id)::int AS count
      FROM mothers
      WHERE 1 = 1
        ${clause}
    `,
      params,
    );
    return res.status(200).json({ status: "success", count: result.rows[0]?.count ?? 0 });
  } catch (error) {
    console.error("Failed to get mothers count by district:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};
