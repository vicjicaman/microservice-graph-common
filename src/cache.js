const redis = require("async-redis");
const uuidv4 = require("uuid/v4");
import * as Utils from "@nebulario/microservice-utils";

export const connect = async ({ host, port, password }) => {
  const client = redis.createClient({
    port,
    host,
    password
  });

  client.on("connect", function() {
    console.log(" -> connected");
  });

  client.on("error", function(e) {
    console.log(" -> error");
    console.log(e.toString());
  });

  return { client };
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

  if (expire) {
    arrOpts.push("EX");
    arrOpts.push(expire);
  }

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
        JSON.stringify({ uuid, processing: false, result, error })
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
  /*
  const exist = await cache.exists(key);

  if (exist) {
    const list = await cache.lrange(key, 0, -1);
    return list.map(serializer.deserialize);
  } else {
    const res = await getter(params, cxt);
    if (res.length === 0) {
      return res;
    }

    const mapped = res.map(serializer.serialize);
    mapped.unshift(key);
    await cache.rpush(mapped);

    if (expire) {
      await cache.expire(key, expire);
    }

    return res;
  }*/
};

export const remove = async (key, cxt) => {
  const {
    services: {
      cache: { client: cache }
    }
  } = cxt;
  await cache.del(key);
};
