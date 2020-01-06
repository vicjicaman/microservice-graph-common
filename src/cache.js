const redis = require("redis");
const asyncRedis = require("async-redis");
const { promisify } = require("util");

const uuidv4 = require("uuid/v4");
import * as Utils from "@nebulario/linker-utils";

export const connect = async ({ host, port, password }, cxt) => {
  cxt.logger.debug("cache.connect.init", { port, host });

  const clientRaw = redis.createClient({
    port,
    host,
    password
  });

  clientRaw.on("connect", function() {
    cxt.logger.debug("cache.connected");
  });

  clientRaw.on("error", function(e) {
    cxt.logger.error("cache.error", { error: e.toString() });
  });

  cxt.logger.debug("cache.connect.decorate");
  const client = asyncRedis.decorate(clientRaw);
  //const client = clientRaw;

  const res = {
    client,
    //clientLockEX: client,
    clientLock: {
      setnx: true,
      set: (lockName, lockTimeoutValue, px, timeout, nx, cb) =>
        client
          .set(lockName, lockTimeoutValue, px, timeout, nx)
          .then(res => cb(null, res))
          .catch(err => cb(err, null)),
      del: (lockName, done) => client.del(lockName).then(res => done())
    },
    lock: null
  };

  cxt.logger.debug("cache.lock.init");
  res.lock = promisify(require("redis-lock")(res.clientLock));

  return res;
};

export const object = async (
  key,
  { params, getter, serializer, expire },
  cxt
) => {
  const {
    services: {
      cache: { client: cache }
    }
  } = cxt;

  const obj = await cache.hgetall(key);

  if (obj) {
    return serializer.deserialize(obj);
  } else {
    const res = await getter(params, cxt);

    const mapped = serializer.serialize(res);
    cache.hmset(key, mapped);

    if (expire) {
      await cache.expire(key, expire);
    }
    return mapped;
  }
};

export const operation = async (type, key, op, opts = {}, cxt) => {
  const {
    services: {
      cache: { client: cache }
    }
  } = cxt;
  const { expire } = opts;

  const uuid = uuidv4();
  const currKey = "Operations/" + type + "/" + key;
  const arrOpts = ["NX"];

  const info = await cache.set(
    currKey,
    JSON.stringify({ uuid, processing: true, result: null }),
    ...arrOpts
  );

  if (info) {
    let result = null;
    let error = null;

    try {
      result = await op();
    } catch (e) {
      error = e.toString();
    } finally {
      await cache.set(
        "Operations/" + type + "/" + key,
        JSON.stringify({ uuid, processing: false, result, error }),
        ...(expire ? ["EX", expire] : [])
      );
    }

    return { result, error };
  } else {
    while (true) {
      const opres = await cache.get(currKey);

      if (opres) {
        const vopres = JSON.parse(opres);
        if (vopres.processing === false) {
          return { result: vopres.result, error: vopres.error };
        }
      }

      await Utils.Process.wait(10);
    }
  }
};

export const list = async (
  key,
  { params, getter, serializer, expire },
  cxt
) => {
  const {
    services: {
      cache: { client: cache }
    }
  } = cxt;

  return await getter(params, cxt);
};

export const remove = async (key, cxt) => {
  const {
    services: {
      cache: { client: cache }
    }
  } = cxt;
  await cache.del(key);
};
