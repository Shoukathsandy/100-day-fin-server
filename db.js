import mongoose from "mongoose";

const DEFAULT_MONGO_URL =
  "mongodb+srv://Shoukathsandy1:Shoukath123@cluster0.elsl2.mongodb.net";
const DEFAULT_DB_NAME = "projectone";

const MONGO_URL = process.env.MONGO_URL || DEFAULT_MONGO_URL;
const DB_NAME = process.env.DB_NAME || DEFAULT_DB_NAME;

async function connect() {
  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false);

  await mongoose.connect(MONGO_URL, {
    dbName: DB_NAME,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 10000,
  });

  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log("MongoDB ping OK");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    throw err;
  }

  console.log(`Connected to MongoDB -> ${DB_NAME}`);
}

async function disconnect() {
  await mongoose.disconnect();
  console.log("Disconnected from MongoDB");
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

export { connect, disconnect, isConnected };
