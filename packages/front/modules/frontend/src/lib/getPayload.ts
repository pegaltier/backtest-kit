import ioc from "./ioc";

export const getPayload = async () => ({
  ioc,
});

export type Payload = Awaited<ReturnType<typeof getPayload>>;

export default getPayload;
