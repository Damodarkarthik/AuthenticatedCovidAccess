const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const dbResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const dbResponseDistrictObject = (dbDistrictobj) => {
  return {
    districtId: dbDistrictobj.district_id,
    districtName: dbDistrictobj.district_name,
    stateId: dbDistrictobj.state_id,
    cases: dbDistrictobj.cases,
    cured: dbDistrictobj.cured,
    active: dbDistrictobj.active,
    deaths: dbDistrictobj.death,
  };
};

//Authenticating User
const authenticateToken = (request, response, next) => {
  const authenticateHeader = request.headers["authorization"];
  const jwtToken = authenticateHeader.split(" ")[1];
  if (jwtToken === undefined) {
    response.status(400);
    response.send("Invalid");
  } else {
    jwt.verify(jwtToken, "Damodar", async (error, payload) => {
      if (error) {
        response.status(400);
        response.send("Invalid Token");
      } else {
        next();
      }
    });
  }
};

//API LOGIN
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const UserExistsQuery = `select * from user where username = '${username}';`;
  const dbUser = await db.get(UserExistsQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      let jwtToken;
      let payload = { username: username };
      jwtToken = jwt.sign(payload, "Damodar");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `select * from state;`;
  const getStates = await db.all(getStatesQuery);
  response.send(
    getStates.map((eachState) => {
      return dbResponseObject(eachState);
    })
  );
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `select * from state where state_id = ${stateId};`;
  const getState = await db.get(getStateQuery);
  response.send(dbResponseObject(getState));
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `INSERT INTO district(district_name, state_id, cases,cured,active,deaths) values('${districtName}',${stateId},${cases}, ${cured},${active},${deaths});`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `select * from district where district_id = ${districtId};`;
    const getDistrict = await db.get(getDistrictQuery);
    response.send(dbResponseDistrictObject(getDistrict));
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `delete from district  where district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Deleted");
  }
);

//API 7

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `update district set district_name = '${districtName}', state_id = ${stateId}, 
        cases = ${cases}, cured = ${cured}, active = ${active}, deaths = ${deaths} where district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details updated");
  }
);

// API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getDetailsQuery = `
      SELECT 
        SUM(cases) AS totalCases, 
        SUM(cured) AS totalCured, 
        SUM(active) AS totalActive, 
        SUM(deaths) AS totalDeaths 
      FROM district 
      WHERE state_id = ${stateId};`;

    const getDetails = await db.get(getDetailsQuery);
    response.send(getDetails);
  }
);
