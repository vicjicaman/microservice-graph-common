var amqp = require("amqplib");
import * as Utils from "@nebulario/linker-utils";

const initQueue = async (channel, { name }, cxt) => {
  const queue = await channel.assertQueue(name, {
    durable: false
  });
};

const initExchange = async (
  channel,
  { name, mode = "fanout", tag = "", consumer = null },
  cxt
) => {
  await channel.assertExchange(name, mode, {
    durable: false
  });

  if (consumer) {
    cxt.logger.debug("queue.register.consumer", { name: consumer.name });
    const qres = await channel.assertQueue(`${consumer.name}`, {});

    await channel.bindQueue(qres.queue, name, tag);
    await channel.consume(qres.queue, consumer.handler, {
      noAck: true
    });
  }
};

export const connect = async (
  name,
  config,
  { host: hostname, port, user: username, password },
  cxt
) => {
  let connected = false;

  while (!connected) {
    try {
      const connection = await amqp.connect({
        protocol: "amqp",
        hostname,
        port,
        username,
        password,
        timeout: 2000
      });

      const channel = await connection.createChannel();

      connection.on("error", function(e) {
        cxt.logger.error("queue.fatal.error", { error: e.toString() });
        process.exit(17);
      });

      cxt.logger.debug("queue.connected", { name });
      const queues = {};

      for (const qinf of config.queues) {
        const { name, type, mode } = qinf;

        cxt.logger.debug("queue.init", { name, type, mode });

        if (type === "exchange") {
          cxt.logger.debug("queue.init.exchange");
          await initExchange(channel, qinf, cxt);
        }

        if (type === "queue") {
          cxt.logger.debug("queue.init.queue");
          await initQueue(channel, qinf, cxt);
        }

        cxt.logger.debug("queue.register", { name, type });
        queues[name] = { type, config: qinf };
      }

      connected = true;
      return { name, config, connection, channel, queues };
    } catch (e) {
      cxt.logger.error("queue.connect.error", {
        error: e.toString(),
        protocol: "amqp",
        hostname,
        port,
        username,
        password,
        timeout: 2000
      });
      await Utils.Process.wait(2500);
    }
  }
};

export const sendPayload = async (service, name, payload, opts, cxt) => {
  return await send(service, name, JSON.stringify(payload), opts, cxt);
};

export const send = async (service, name, msg, { tag = "" }, cxt) => {
  const { name: serviceName, channel, queues } = service;
  const { type } = queues[name];

  cxt.logger.debug("queue.send", {
    service: serviceName,
    name,
    type,
    tag,
    msg
  });

  if (type === "exchange") {
    await channel.publish(name, tag, Buffer.from(msg));
  }

  if (type === "queue") {
    await channel.sendToQueue(name, Buffer.from(msg));
  }
};

/*
function(msg) {
  if (msg.content) {
    console.log(" [x] %s", msg.content.toString());
  }
}
*/
