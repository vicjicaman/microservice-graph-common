var amqp = require("amqplib");

export const connect = async (
  queues,
  { host: hostname, port, user: username, password }
) => {
  const connection = await amqp.connect({
    protocol: "amqp",
    hostname,
    port,
    username,
    password,
    timeout: 2000
  });

  const channel = await connection.createChannel();

  const ids = {};
  for (const queue of queues) {
    const { id, name } = queue;

    ids[id] = queue;

    await channel.assertQueue(name, {
      durable: false
    });
  }

  connection.on("error", function(e) {
    console.log(" -> error");
    console.log(e.toString());
  });

  return { queues, connection, channel, ids };
};

export const send = (id, msg, cxt) => {
  const {
    services: {
      queue: { channel, ids }
    }
  } = cxt;

  const { name } = ids[id];
  channel.sendToQueue(name, Buffer.from(msg));
};
