const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");

const settingsCollection = "settings";
const settingsDoc = "mobile_app";

const updateSettings = async (req, res) => {
  const settingsRef = await req.db
    .collection(settingsCollection)
    .doc(settingsDoc)
    .get();

  if (!settingsRef.exists) {
    throw new BadRequestError("Settings does not exist");
  }

  const settings = { ...req.body };

  await settingsRef.ref.update(settings);

  res.status(StatusCodes.OK).json({
    code: "update_settings",
    message: "Settings updated successfully",
    data: { id: settingsRef.id },
  });
};

module.exports = { updateSettings };
