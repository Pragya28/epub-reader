import {
  registerRequestSchema,
  type RegisterResponse,
} from "../../contracts/register.ts";
import { hashToken, issueToken } from "../auth/auth.ts";
import { createDeviceWithProof } from "../db/db.ts";
import { constraintOf, errorResponse, json, parseBody } from "./http.ts";

export async function handleRegister(
  req: Request,
  now = new Date(),
): Promise<Response> {
  const body = await parseBody(req, registerRequestSchema);
  if ("response" in body) return body.response;
  const { userId, deviceId, label, proof } = body.data;

  const token = issueToken();
  try {
    const created = await createDeviceWithProof({
      userId,
      proofHash: hashToken(proof),
      deviceId,
      label,
      tokenHash: hashToken(token),
      now,
    });
    // Unknown user and wrong proof are indistinguishable by design.
    if (!created) {
      return errorResponse("registration_rejected", "Registration rejected");
    }
  } catch (e) {
    if (constraintOf(e) === "devices_pkey") {
      return errorResponse("device_exists", "Device already registered");
    }
    throw e;
  }
  return json({ token } satisfies RegisterResponse);
}
