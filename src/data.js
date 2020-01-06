import * as Utils from "@nebulario/microservice-utils";

export const connect = async (
  { mongoose, url, user, password, database },
  cxt
) => {
  let db = null;
  let connected = false;

  while (!connected) {
    try {
      cxt.logger.info("data.connected.init", { user, url, database });

      const db = await mongoose.connect(
        "mongodb://" + user + ":" + password + "@" + url + "/" + database,
        {
          useNewUrlParser: true,
          reconnectTries: 3,
          reconnectInterval: 100
        }
      );

      mongoose.connection.on("disconnected", () => {
        cxt.logger.info("data.disconnected");
      });
      mongoose.connection.on("reconnect", () => {
        cxt.logger.info("data.reconnect");
      });
      mongoose.connection.on("connected", () => {
        cxt.logger.info("data.connected");
      });
      mongoose.connection.on("reconnectFailed", () => {
        cxt.logger.info("data.reconnecting.failed");
        process.exit(17);
      });
      connected = true;
    } catch (e) {
      cxt.logger.error("data.connect.error", { error: e.toString() });

      await Utils.Process.wait(2500);
    }
  }

  cxt.services.database = { mongoose, models: {}, db };
  return { db };
};

export const database = ({ services: { database } }) => database;

export const register = (name, res, cxt) => {
  const {
    services: { database }
  } = cxt;
  database.models[name] = res;
  return res;
};

export const get = (
  name,
  {
    services: {
      database: { mongoose, models }
    }
  }
) => {
  if (!models[name]) {
    cxt.logger.error("unregister.model", { name });
    throw new Error("unregister.model", { name });
  }

  return models[name].model;
};



export const schema = (
  name,
  {
    services: {
      database: { mongoose, models }
    }
  }
) => {
  if (!models[name]) {
    cxt.logger.error("unregister.schema", { name });
    throw new Error("unregister.schema", { name });
  }

  return models[name].schema;
};
