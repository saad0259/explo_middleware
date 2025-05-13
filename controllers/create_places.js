const csv = require("csv-parser");
const stream = require("stream");
const mssql = require("mssql");
const { BadRequestError } = require("../errors"); // Custom error handler
const pool = require("../db/connection");

const placesTable = "places";
const minPlacesTable = "min_places";

// ✅ Define required columns
const REQUIRED_COLUMNS = [
  "CODE",
  "SOURCES",
  "Name",
  "English Text",
  "Spanish Text",
  "Chinese Text",
  "German Text",
  "French Text",
  "Russian Text",
  "Portuguese Text",
  "Italian Text",
  "Hindi Text",
  "Arab Text",
  "Turkish Text",
  "Japanese Text",
  "Romanian Text",
  "Polish Text",
  "Czech Text",
  "Indonesian Text",
  "Level",
  "Coordinates",
  "Province",
  "Country",
  "Tag",
  "IMAGE",
  "Web",
  "Phone",
];
const OPTIONAL_COLUMNS = ["Web", "Phone"]; // Can be null

// Batch size for chunked inserts
const BATCH_SIZE = 50;

// ✅ Function to validate CSV structure
const validateCSVStructure = (headers) => {
  const cleanedHeaders = headers.map((col) =>
    col.trim().replace(/\uFEFF/g, "")
  );
  if (cleanedHeaders.length !== REQUIRED_COLUMNS.length) {
    throw new BadRequestError(
      "CSV column count does not match the required format."
    );
  }
  cleanedHeaders.forEach((col, index) => {
    if (col !== REQUIRED_COLUMNS[index]) {
      throw new BadRequestError(
        `Column order mismatch: Expected '${REQUIRED_COLUMNS[index]}' but got '${col}'`
      );
    }
  });
};

// ✅ Validate Row Data
const validateRowData = (row) => {
  for (const col of REQUIRED_COLUMNS) {
    if (!OPTIONAL_COLUMNS.includes(col)) {
      const value =
        row[col]
          ?.trim()
          .replace(/\uFEFF/g, "")
          .replace(/\s+/g, " ") || "";
      if (!value)
        throw new BadRequestError(`Missing value for required field: ${col}`);
    }
  }
};

// ✅ Normalize Keys
const normalizeKeys = (row) => {
  const newRow = {};
  for (const key in row) {
    const cleanKey = key.replace(/\uFEFF/g, "").trim();
    newRow[cleanKey] = row[key];
  }
  return newRow;
};

// 🔧 Bulk insert into places table
const insertBulkIntoPlaces = async (pool, records) => {
  if (!records.length) return;

  const request = pool.request();

  // Create a Table Variable (NOT a Temp Table)
  let query = `
    DECLARE @Temp_Places TABLE (
      CODE NVARCHAR(50) NOT NULL PRIMARY KEY,
      SOURCES NVARCHAR(MAX) NOT NULL,
      Name NVARCHAR(MAX) NOT NULL,
      English_Text NVARCHAR(MAX) NOT NULL,
      Spanish_Text NVARCHAR(MAX) NOT NULL,
      Chinese_Text NVARCHAR(MAX) NOT NULL,
      German_Text NVARCHAR(MAX) NOT NULL,
      French_Text NVARCHAR(MAX) NOT NULL,
      Russian_Text NVARCHAR(MAX) NOT NULL,
      Portuguese_Text NVARCHAR(MAX) NOT NULL,
      Italian_Text NVARCHAR(MAX) NOT NULL,
      Hindi_Text NVARCHAR(MAX) NOT NULL,
      Arab_Text NVARCHAR(MAX) NOT NULL,
      Turkish_Text NVARCHAR(MAX) NOT NULL,
      Japanese_Text NVARCHAR(MAX) NOT NULL,
      Romanian_Text NVARCHAR(MAX) NOT NULL,
      Polish_Text NVARCHAR(MAX) NOT NULL,
      Czech_Text NVARCHAR(MAX) NOT NULL,
      Indonesian_Text NVARCHAR(MAX) NOT NULL,
      Level TINYINT NOT NULL,
      Coordinates NVARCHAR(50) NOT NULL,
      Province NVARCHAR(200) NOT NULL,
      Country NVARCHAR(50) NOT NULL,
      Tag NVARCHAR(50) NOT NULL,
      IMAGE NVARCHAR(MAX) NOT NULL,
      Web NVARCHAR(MAX) NULL,
      Phone NVARCHAR(MAX) NULL
    );
  `;

  // Insert all records into @Temp_Places (Using Parameterized Queries)
  for (let i = 0; i < records.length; i++) {
    const row = records[i];

    query += `
      INSERT INTO @Temp_Places (CODE, SOURCES, Name, English_Text, Spanish_Text, Chinese_Text, German_Text, 
        French_Text, Russian_Text, Portuguese_Text, Italian_Text, Hindi_Text, Arab_Text, Turkish_Text, 
        Japanese_Text, Romanian_Text, Polish_Text, Czech_Text, Indonesian_Text, Level, Coordinates, Province, 
        Country, Tag, IMAGE, Web, Phone) 
      VALUES (
        @CODE${i}, @SOURCES${i}, @Name${i}, @English_Text${i}, @Spanish_Text${i}, @Chinese_Text${i}, 
        @German_Text${i}, @French_Text${i}, @Russian_Text${i}, @Portuguese_Text${i}, @Italian_Text${i}, 
        @Hindi_Text${i}, @Arab_Text${i}, @Turkish_Text${i}, @Japanese_Text${i}, @Romanian_Text${i}, 
        @Polish_Text${i}, @Czech_Text${i}, @Indonesian_Text${i}, @Level${i}, @Coordinates${i}, 
        @Province${i}, @Country${i}, @Tag${i}, @IMAGE${i}, @Web${i}, @Phone${i}
      );
    `;

    // Add parameters to avoid string breaking issues
    request.input(`CODE${i}`, row.CODE);
    request.input(`SOURCES${i}`, row.SOURCES);
    request.input(`Name${i}`, row.Name);
    request.input(`English_Text${i}`, row.English_Text);
    request.input(`Spanish_Text${i}`, row.Spanish_Text);
    request.input(`Chinese_Text${i}`, row.Chinese_Text);
    request.input(`German_Text${i}`, row.German_Text);
    request.input(`French_Text${i}`, row.French_Text);
    request.input(`Russian_Text${i}`, row.Russian_Text);
    request.input(`Portuguese_Text${i}`, row.Portuguese_Text);
    request.input(`Italian_Text${i}`, row.Italian_Text);
    request.input(`Hindi_Text${i}`, row.Hindi_Text);
    request.input(`Arab_Text${i}`, row.Arab_Text);
    request.input(`Turkish_Text${i}`, row.Turkish_Text);
    request.input(`Japanese_Text${i}`, row.Japanese_Text);
    request.input(`Romanian_Text${i}`, row.Romanian_Text);
    request.input(`Polish_Text${i}`, row.Polish_Text);
    request.input(`Czech_Text${i}`, row.Czech_Text);
    request.input(`Indonesian_Text${i}`, row.Indonesian_Text);
    request.input(`Level${i}`, row.Level);
    request.input(`Coordinates${i}`, row.Coordinates);
    request.input(`Province${i}`, row.Province);
    request.input(`Country${i}`, row.Country);
    request.input(`Tag${i}`, row.Tag);
    request.input(`IMAGE${i}`, row.IMAGE);
    request.input(`Web${i}`, row.Web || null);
    request.input(`Phone${i}`, row.Phone || null);
  }

  // MERGE statement to Upsert data
  query += `
    MERGE INTO ${placesTable} AS target
    USING @Temp_Places AS source
    ON target.CODE = source.CODE
    WHEN MATCHED THEN 
      UPDATE SET
        target.SOURCES = source.SOURCES,
        target.Name = source.Name,
        target.English_Text = source.English_Text,
        target.Spanish_Text = source.Spanish_Text,
        target.Chinese_Text = source.Chinese_Text,
        target.German_Text = source.German_Text,
        target.French_Text = source.French_Text,
        target.Russian_Text = source.Russian_Text,
        target.Portuguese_Text = source.Portuguese_Text,
        target.Italian_Text = source.Italian_Text,
        target.Hindi_Text = source.Hindi_Text,
        target.Arab_Text = source.Arab_Text,
        target.Turkish_Text = source.Turkish_Text,
        target.Japanese_Text = source.Japanese_Text,
        target.Romanian_Text = source.Romanian_Text,
        target.Polish_Text = source.Polish_Text,
        target.Czech_Text = source.Czech_Text,
        target.Indonesian_Text = source.Indonesian_Text,
        target.Level = source.Level,
        target.Coordinates = source.Coordinates,
        target.Province = source.Province,
        target.Country = source.Country,
        target.Tag = source.Tag,
        target.IMAGE = source.IMAGE,
        target.Web = source.Web,
        target.Phone = source.Phone
    WHEN NOT MATCHED THEN 
      INSERT (CODE, SOURCES, Name, English_Text, Spanish_Text, Chinese_Text, German_Text, French_Text, Russian_Text, 
        Portuguese_Text, Italian_Text, Hindi_Text, Arab_Text, Turkish_Text, Japanese_Text, Romanian_Text, Polish_Text, 
        Czech_Text, Indonesian_Text, Level, Coordinates, Province, Country, Tag, IMAGE, Web, Phone)
      VALUES (source.CODE, source.SOURCES, source.Name, source.English_Text, source.Spanish_Text, source.Chinese_Text, 
        source.German_Text, source.French_Text, source.Russian_Text, source.Portuguese_Text, source.Italian_Text, 
        source.Hindi_Text, source.Arab_Text, source.Turkish_Text, source.Japanese_Text, source.Romanian_Text, 
        source.Polish_Text, source.Czech_Text, source.Indonesian_Text, source.Level, source.Coordinates, 
        source.Province, source.Country, source.Tag, source.IMAGE, source.Web, source.Phone);
  `;

  // Execute Query
  await request.query(query);
};

const insertBulkIntoMinPlaces = async (pool, records) => {
  if (!records.length) return;

  const request = pool.request();

  // Declare table variable with Web and Phone
  let query = `
    DECLARE @Temp_MinPlaces TABLE (
      CODE NVARCHAR(50) NOT NULL PRIMARY KEY,
      Name NVARCHAR(MAX) NOT NULL,
      Province NVARCHAR(200) NOT NULL,
      Country NVARCHAR(50) NOT NULL,
      Coordinates NVARCHAR(50) NOT NULL,
      Tag NVARCHAR(50) NOT NULL,
      IMAGE NVARCHAR(MAX) NOT NULL,
      Level TINYINT NOT NULL,
      Web NVARCHAR(MAX) NULL,
      Phone NVARCHAR(MAX) NULL
    );
  `;

  // Insert records into @Temp_MinPlaces
  for (let i = 0; i < records.length; i++) {
    const row = records[i];

    query += `
      INSERT INTO @Temp_MinPlaces (CODE, Name, Province, Country, Coordinates, Tag, IMAGE, Level, Web, Phone) 
      VALUES (@CODE${i}, @Name${i}, @Province${i}, @Country${i}, @Coordinates${i}, @Tag${i}, @IMAGE${i}, @Level${i}, @Web${i}, @Phone${i});
    `;

    request.input(`CODE${i}`, row.CODE);
    request.input(`Name${i}`, row.Name);
    request.input(`Province${i}`, row.Province);
    request.input(`Country${i}`, row.Country);
    request.input(`Coordinates${i}`, row.Coordinates);
    request.input(`Tag${i}`, row.Tag);
    request.input(`IMAGE${i}`, row.IMAGE);
    request.input(`Level${i}`, row.Level ? parseInt(row.Level, 10) || 0 : 0);
    request.input(`Web${i}`, row.Web || null);
    request.input(`Phone${i}`, row.Phone || null);
  }

  // MERGE statement to update or insert data
  query += `
    MERGE INTO ${minPlacesTable} AS target
    USING @Temp_MinPlaces AS source
    ON target.CODE = source.CODE
    WHEN MATCHED THEN 
      UPDATE SET
        target.Name = source.Name,
        target.Province = source.Province,
        target.Country = source.Country,
        target.Coordinates = source.Coordinates,
        target.Tag = source.Tag,
        target.IMAGE = source.IMAGE,
        target.Level = source.Level,
        target.Web = source.Web,
        target.Phone = source.Phone
    WHEN NOT MATCHED THEN 
      INSERT (CODE, Name, Province, Country, Coordinates, Tag, IMAGE, Level, Web, Phone)
      VALUES (source.CODE, source.Name, source.Province, source.Country, source.Coordinates, source.Tag, source.IMAGE, source.Level, source.Web, source.Phone);
  `;

  // Execute Query
  await request.query(query);
};

const getExistingCodes = async (pool) => {
  const result = await pool.request().query(`SELECT CODE FROM ${placesTable}`);
  return new Set(result.recordset.map((row) => row.CODE)); // Convert to Set for fast lookup
};

const COLUMN_MAPPING = {
  "English Text": "English_Text",
  "Spanish Text": "Spanish_Text",
  "Chinese Text": "Chinese_Text",
  "German Text": "German_Text",
  "French Text": "French_Text",
  "Russian Text": "Russian_Text",
  "Portuguese Text": "Portuguese_Text",
  "Italian Text": "Italian_Text",
  "Hindi Text": "Hindi_Text",
  "Arab Text": "Arab_Text",
  "Turkish Text": "Turkish_Text",
  "Japanese Text": "Japanese_Text",
  "Romanian Text": "Romanian_Text",
  "Polish Text": "Polish_Text",
  "Czech Text": "Czech_Text",
  "Indonesian Text": "Indonesian_Text",
};

// ✅ Normalize CSV Row Keys for SQL Compatibility
const normalizeRowForSQL = (row) => {
  const newRow = {};
  for (const key in row) {
    const cleanKey = key.replace(/\uFEFF/g, "").trim();
    const mappedKey = COLUMN_MAPPING[cleanKey] || cleanKey;
    newRow[mappedKey] = row[key] ? String(row[key]).trim() : null; // Force string conversion
  }
  return newRow;
};

const addPlaces = async (req, res) => {
  if (!req.file) throw new BadRequestError("Please upload a CSV file.");

  const results = [];
  const overrides = [];
  const fails = [];
  let responseSent = false;
  const bufferStream = new stream.PassThrough();
  bufferStream.end(req.file.buffer);

  const poolResult = await pool;
  const existingCodes = await getExistingCodes(poolResult);

  bufferStream
    .pipe(csv({ separator: ";" }))
    .on("headers", (headers) => {
      try {
        validateCSVStructure(headers);
      } catch (error) {
        responseSent = true;
        return res.status(400).json({ error: error.message });
      }
    })
    .on("data", (row) => {
      try {
        row = normalizeKeys(row); // Step 1: Remove BOM, trim spaces
        validateRowData(row);
        row = normalizeRowForSQL(row); // Step 2: Convert to SQL column names

        if (existingCodes.has(row.CODE)) {
          overrides.push({ CODE: row.CODE, operationStatus: "override" });
        }
        results.push(row);
      } catch (error) {
        fails.push({
          CODE: row?.CODE || "UNKNOWN",
          error: error.message,
          operationStatus: "failed",
        });
      }
    })
    .on("end", async () => {
      if (responseSent) return;
      try {
        // Write in batches of 50
        for (let i = 0; i < results.length; i += BATCH_SIZE) {
          const batch = results.slice(i, i + BATCH_SIZE);
          await insertBulkIntoPlaces(poolResult, batch);
          await insertBulkIntoMinPlaces(poolResult, batch);
        }

        res.status(201).json({
          message: "CSV data processed",
          totalRecords: results.length,
          successRecords: results.length - overrides.length,
          overrideRecords: overrides.length,
          failedRecords: fails.length,
          failedDetails: fails,
          overrideDetails: overrides,
        });
      } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Failed to process data" });
      }
    });
};

module.exports = { addPlaces };
