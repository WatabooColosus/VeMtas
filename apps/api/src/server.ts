import { createServer } from "node:http";
import { Pool } from "pg";
import { env } from "@vemtas/config";
import { correlationId, log } from "@vemtas/observability";
const pool = new Pool({ connectionString: env.databaseUrl });
const body = async (req: import("node:http").IncomingMessage) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || "{}");
};
const reply = (
  res: import("node:http").ServerResponse,
  status: number,
  value: unknown,
) => {
  res.statusCode = status;
  res.end(JSON.stringify(value));
};
const server = createServer(async (req, res) => {
  const cid = correlationId(
    req.headers["x-correlation-id"] as string | undefined,
  );
  res.setHeader("content-type", "application/json");
  res.setHeader("x-correlation-id", cid);
  if (req.url === "/health" || req.url === "/api/v1/health") {
    reply(res, 200, { status: "ok", service: "api", version: "0.1.0" });
    return;
  }
  if (req.url === "/ready" || req.url === "/api/v1/ready") {
    try {
      await pool.query("select 1");
      reply(res, 200, { status: "ready", checks: { database: "ok" } });
    } catch {
      reply(res, 503, {
        status: "not_ready",
        checks: { database: "unavailable" },
      });
    }
    return;
  }
  if (req.method === "POST" && req.url === "/api/v1/auth/register") {
    try {
      const input = await body(req);
      if (
        typeof input.primary_email !== "string" ||
        typeof input.display_name !== "string" ||
        !input.primary_email.includes("@") ||
        !input.display_name.trim()
      ) {
        reply(res, 400, {
          error: {
            code: "INVALID_INPUT",
            message: "primary_email and display_name are required",
            correlation_id: cid,
            details: {},
          },
        });
        return;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const user = await client.query(
          "INSERT INTO users (primary_email,status) VALUES ($1,'ACTIVE') RETURNING id,primary_email,status,created_at",
          [input.primary_email],
        );
        await client.query(
          "INSERT INTO user_profiles (user_id,display_name) VALUES ($1,$2)",
          [user.rows[0].id, input.display_name.trim()],
        );
        await client.query(
          "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id,metadata_json) VALUES ('USER',$1,'UserRegistered','USER',$1,$2,$3)",
          [user.rows[0].id, cid, JSON.stringify({ source: "api" })],
        );
        await client.query("COMMIT");
        reply(res, 201, { data: user.rows[0] });
      } catch (error) {
        await client.query("ROLLBACK");
        if ((error as { code?: string }).code === "23505")
          reply(res, 409, {
            error: {
              code: "DUPLICATE_USER",
              message: "User already exists",
              correlation_id: cid,
              details: {},
            },
          });
        else throw error;
      } finally {
        client.release();
      }
      return;
    } catch {
      reply(res, 400, {
        error: {
          code: "INVALID_JSON",
          message: "Invalid request body",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
  }
  if (
    req.method === "POST" &&
    req.url?.match(/^\/api\/v1\/me\/credentials\/[^/]+\/block$/)
  ) {
    const credentialId = req.url.split("/")[5];
    const actorId = req.headers["x-actor-id"] as string | undefined;
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const result = await pool.query(
      "UPDATE credentials SET status='BLOCKED', blocked_at=now() WHERE id=$1 AND user_id=$2 AND status='ACTIVE' RETURNING id,status,blocked_at",
      [credentialId, actorId],
    );
    if (!result.rowCount) {
      if (req.method === "POST" && req.url === "/api/v1/businesses") {
        const actorId = req.headers["x-actor-id"] as string | undefined;
        if (!actorId) {
          reply(res, 401, {
            error: {
              code: "UNAUTHENTICATED",
              message: "Actor required",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        try {
          const input = await body(req);
          if (typeof input.name !== "string" || !input.name.trim()) {
            reply(res, 400, {
              error: {
                code: "INVALID_INPUT",
                message: "name is required",
                correlation_id: cid,
                details: {},
              },
            });
            return;
          }
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            const b = await client.query(
              "INSERT INTO businesses (name,status,verification_state) VALUES ($1,'DRAFT','PENDING') RETURNING *",
              [input.name.trim()],
            );
            await client.query(
              "INSERT INTO business_memberships (business_id,user_id,role) VALUES ($1,$2,'BUSINESS_OWNER')",
              [b.rows[0].id, actorId],
            );
            await client.query(
              "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'BusinessCreated','BUSINESS',$2,$3)",
              [actorId, b.rows[0].id, cid],
            );
            await client.query("COMMIT");
            reply(res, 201, { data: b.rows[0] });
          } catch (e) {
            await client.query("ROLLBACK");
            throw e;
          } finally {
            client.release();
          }
        } catch {
          reply(res, 400, {
            error: {
              code: "INVALID_REQUEST",
              message: "Business could not be created",
              correlation_id: cid,
              details: {},
            },
          });
        }
        return;
      }
      const branchMatch = req.url?.match(
        /^\/api\/v1\/businesses\/([^/]+)\/branches$/,
      );
      if (req.method === "POST" && branchMatch) {
        const actorId = req.headers["x-actor-id"] as string | undefined;
        if (!actorId) {
          reply(res, 401, {
            error: {
              code: "UNAUTHENTICATED",
              message: "Actor required",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const input = await body(req);
        const allowed = await pool.query(
          "SELECT 1 FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND role IN ('BUSINESS_OWNER','BUSINESS_ADMIN') AND status='ACTIVE'",
          [branchMatch[1], actorId],
        );
        if (!allowed.rowCount) {
          reply(res, 403, {
            error: {
              code: "FORBIDDEN",
              message: "Business scope denied",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const b = await pool.query(
          "INSERT INTO branches (business_id,name) VALUES ($1,$2) RETURNING *",
          [branchMatch[1], input.name],
        );
        reply(res, 201, { data: b.rows[0] });
        return;
      }
      const terminalMatch = req.url?.match(
        /^\/api\/v1\/branches\/([^/]+)\/terminals$/,
      );
      if (req.method === "POST" && terminalMatch) {
        const actorId = req.headers["x-actor-id"] as string | undefined;
        if (!actorId) {
          reply(res, 401, {
            error: {
              code: "UNAUTHENTICATED",
              message: "Actor required",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const allowed = await pool.query(
          "SELECT 1 FROM business_memberships m JOIN branches b ON b.business_id=m.business_id WHERE b.id=$1 AND m.user_id=$2 AND m.role IN ('BUSINESS_OWNER','BUSINESS_ADMIN','BRANCH_MANAGER') AND m.status='ACTIVE'",
          [terminalMatch[1], actorId],
        );
        if (!allowed.rowCount) {
          reply(res, 403, {
            error: {
              code: "FORBIDDEN",
              message: "Branch scope denied",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const input = await body(req);
        const t = await pool.query(
          "INSERT INTO terminals (branch_id,terminal_type,status) VALUES ($1,$2,'PENDING') RETURNING *",
          [terminalMatch[1], input.terminal_type ?? "WEB"],
        );
        reply(res, 201, { data: t.rows[0] });
        return;
      }
      const replaceMatch = req.url?.match(
        /^\/api\/v1\/me\/credentials\/([^/]+)\/replace$/,
      );
      if (req.method === "POST" && replaceMatch) {
        const actorId = req.headers["x-actor-id"] as string | undefined;
        if (!actorId) {
          reply(res, 401, {
            error: {
              code: "UNAUTHENTICATED",
              message: "Actor required",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const old = await client.query(
            "SELECT user_id,type FROM credentials WHERE id=$1 AND user_id=$2 AND status IN ('ACTIVE','BLOCKED') FOR UPDATE",
            [replaceMatch[1], actorId],
          );
          if (!old.rowCount) {
            await client.query("ROLLBACK");
            const businessAction = req.url?.match(
              /^\/api\/v1\/businesses\/([^/]+)\/(submit|approve|activate|suspend)$/,
            );
            if (req.method === "POST" && businessAction) {
              const actorId = req.headers["x-actor-id"] as string | undefined;
              if (!actorId) {
                reply(res, 401, {
                  error: {
                    code: "UNAUTHENTICATED",
                    message: "Actor required",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              const id = businessAction[1],
                action = businessAction[2];
              const b = await pool.query(
                "SELECT status FROM businesses WHERE id=$1",
                [id],
              );
              if (!b.rowCount) {
                const credentialLink = req.url?.match(
                  /^\/api\/v1\/users\/([^/]+)\/credentials$/,
                );
                if (req.method === "POST" && credentialLink) {
                  const actorId = req.headers["x-actor-id"] as
                    | string
                    | undefined;
                  if (!actorId) {
                    reply(res, 401, {
                      error: {
                        code: "UNAUTHENTICATED",
                        message: "Actor required",
                        correlation_id: cid,
                        details: {},
                      },
                    });
                    return;
                  }
                  if (
                    actorId !== credentialLink[1] &&
                    !req.headers["x-platform-actor-id"]
                  ) {
                    reply(res, 403, {
                      error: {
                        code: "FORBIDDEN",
                        message: "Credential scope denied",
                        correlation_id: cid,
                        details: {},
                      },
                    });
                    return;
                  }
                  const input = await body(req);
                  if (
                    typeof input.public_reference !== "string" ||
                    !input.public_reference.trim()
                  ) {
                    reply(res, 400, {
                      error: {
                        code: "INVALID_INPUT",
                        message: "public_reference is required",
                        correlation_id: cid,
                        details: {},
                      },
                    });
                    return;
                  }
                  try {
                    const c = await pool.query(
                      "INSERT INTO credentials (user_id,type,public_reference,status) VALUES ($1,$2,$3,'PENDING') RETURNING id,user_id,type,public_reference,status",
                      [
                        credentialLink[1],
                        input.type ?? "NFC",
                        input.public_reference.trim(),
                      ],
                    );
                    await pool.query(
                      "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialLinked','CREDENTIAL',$2,$3)",
                      [actorId, c.rows[0].id, cid],
                    );
                    reply(res, 201, { data: c.rows[0] });
                  } catch (e) {
                    if ((e as { code?: string }).code === "23505") {
                      reply(res, 409, {
                        error: {
                          code: "CREDENTIAL_ALREADY_LINKED",
                          message: "Credential reference already linked",
                          correlation_id: cid,
                          details: {},
                        },
                      });
                    } else {
                      throw e;
                    }
                  }
                  return;
                }
                const credentialActivate = req.url?.match(
                  /^\/api\/v1\/credentials\/([^/]+)\/activate$/,
                );
                if (req.method === "POST" && credentialActivate) {
                  const actorId = req.headers["x-actor-id"] as
                    | string
                    | undefined;
                  if (!actorId) {
                    reply(res, 401, {
                      error: {
                        code: "UNAUTHENTICATED",
                        message: "Actor required",
                        correlation_id: cid,
                        details: {},
                      },
                    });
                    return;
                  }
                  const c = await pool.query(
                    "UPDATE credentials SET status='ACTIVE' WHERE id=$1 AND status='PENDING' RETURNING id,status",
                    [credentialActivate[1]],
                  );
                  if (!c.rowCount) {
                    reply(res, 409, {
                      error: {
                        code: "INVALID_CREDENTIAL_TRANSITION",
                        message: "Credential is not pending",
                        correlation_id: cid,
                        details: {},
                      },
                    });
                    return;
                  }
                  await pool.query(
                    "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialActivated','CREDENTIAL',$2,$3)",
                    [actorId, credentialActivate[1], cid],
                  );
                  reply(res, 200, { data: c.rows[0] });
                  return;
                }
                reply(res, 404, {
                  error: {
                    code: "BUSINESS_NOT_FOUND",
                    message: "Business not found",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              const role = await pool.query(
                "SELECT role FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND status='ACTIVE'",
                [id, actorId],
              );
              const current = b.rows[0].status;
              const platform = actorId === req.headers["x-platform-actor-id"];
              const target =
                action === "submit"
                  ? "PENDING_VERIFICATION"
                  : action === "approve"
                    ? "VERIFIED"
                    : action === "activate"
                      ? "ACTIVE"
                      : "SUSPENDED";
              const allowed =
                (action === "submit" &&
                  role.rows.some(
                    (r: { role: string }) => r.role === "BUSINESS_OWNER",
                  ) &&
                  current === "DRAFT") ||
                (action === "approve" &&
                  platform &&
                  current === "UNDER_REVIEW") ||
                (action === "activate" && platform && current === "VERIFIED") ||
                (action === "suspend" && platform && current === "ACTIVE");
              if (!allowed) {
                reply(res, 403, {
                  error: {
                    code: "FORBIDDEN_OR_INVALID_TRANSITION",
                    message: "Business operation denied",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              await pool.query("UPDATE businesses SET status=$1 WHERE id=$2", [
                target,
                id,
              ]);
              await pool.query(
                "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,$2,'BUSINESS',$3,$4)",
                [
                  actorId,
                  `Business${action[0].toUpperCase() + action.slice(1)}`,
                  id,
                  cid,
                ],
              );
              reply(res, 200, { data: { id, status: target } });
              return;
            }
            const credentialLink = req.url?.match(
              /^\/api\/v1\/users\/([^/]+)\/credentials$/,
            );
            if (req.method === "POST" && credentialLink) {
              const actorId = req.headers["x-actor-id"] as string | undefined;
              if (!actorId) {
                reply(res, 401, {
                  error: {
                    code: "UNAUTHENTICATED",
                    message: "Actor required",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              if (
                actorId !== credentialLink[1] &&
                !req.headers["x-platform-actor-id"]
              ) {
                reply(res, 403, {
                  error: {
                    code: "FORBIDDEN",
                    message: "Credential scope denied",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              const input = await body(req);
              if (
                typeof input.public_reference !== "string" ||
                !input.public_reference.trim()
              ) {
                reply(res, 400, {
                  error: {
                    code: "INVALID_INPUT",
                    message: "public_reference is required",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              try {
                const c = await pool.query(
                  "INSERT INTO credentials (user_id,type,public_reference,status) VALUES ($1,$2,$3,'PENDING') RETURNING id,user_id,type,public_reference,status",
                  [
                    credentialLink[1],
                    input.type ?? "NFC",
                    input.public_reference.trim(),
                  ],
                );
                await pool.query(
                  "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialLinked','CREDENTIAL',$2,$3)",
                  [actorId, c.rows[0].id, cid],
                );
                reply(res, 201, { data: c.rows[0] });
              } catch (e) {
                if ((e as { code?: string }).code === "23505") {
                  reply(res, 409, {
                    error: {
                      code: "CREDENTIAL_ALREADY_LINKED",
                      message: "Credential reference already linked",
                      correlation_id: cid,
                      details: {},
                    },
                  });
                } else {
                  throw e;
                }
              }
              return;
            }
            const credentialActivate = req.url?.match(
              /^\/api\/v1\/credentials\/([^/]+)\/activate$/,
            );
            if (req.method === "POST" && credentialActivate) {
              const actorId = req.headers["x-actor-id"] as string | undefined;
              if (!actorId) {
                reply(res, 401, {
                  error: {
                    code: "UNAUTHENTICATED",
                    message: "Actor required",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              const c = await pool.query(
                "UPDATE credentials SET status='ACTIVE' WHERE id=$1 AND status='PENDING' RETURNING id,status",
                [credentialActivate[1]],
              );
              if (!c.rowCount) {
                reply(res, 409, {
                  error: {
                    code: "INVALID_CREDENTIAL_TRANSITION",
                    message: "Credential is not pending",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              await pool.query(
                "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialActivated','CREDENTIAL',$2,$3)",
                [actorId, credentialActivate[1], cid],
              );
              reply(res, 200, { data: c.rows[0] });
              return;
            }
            reply(res, 404, {
              error: {
                code: "CREDENTIAL_NOT_FOUND",
                message: "Credential unavailable",
                correlation_id: cid,
                details: {},
              },
            });
            return;
          }
          const ref = `cred_${crypto.randomUUID()}`;
          const fresh = await client.query(
            "INSERT INTO credentials (user_id,type,public_reference,status) VALUES ($1,$2,$3,'ACTIVE') RETURNING id,public_reference,status",
            [actorId, old.rows[0].type, ref],
          );
          await client.query(
            "UPDATE credentials SET status='REPLACED',replaced_by_id=$1 WHERE id=$2",
            [fresh.rows[0].id, replaceMatch[1]],
          );
          await client.query(
            "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialReplaced','CREDENTIAL',$2,$3)",
            [actorId, replaceMatch[1], cid],
          );
          await client.query("COMMIT");
          reply(res, 201, { data: fresh.rows[0] });
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
        return;
      }
      const terminalAction = req.url?.match(
        /^\/api\/v1\/terminals\/([^/]+)\/(authorize|suspend|resume)$/,
      );
      if (req.method === "POST" && terminalAction) {
        const actorId = req.headers["x-actor-id"] as string | undefined;
        if (!actorId) {
          reply(res, 401, {
            error: {
              code: "UNAUTHENTICATED",
              message: "Actor required",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const allowed = await pool.query(
          "SELECT t.status,m.business_id,m.role FROM terminals t JOIN branches b ON b.id=t.branch_id JOIN business_memberships m ON m.business_id=b.business_id WHERE t.id=$1 AND m.user_id=$2 AND m.role IN ('BUSINESS_OWNER','BUSINESS_ADMIN','BRANCH_MANAGER') AND m.status='ACTIVE'",
          [terminalAction[1], actorId],
        );
        if (!allowed.rowCount) {
          reply(res, 403, {
            error: {
              code: "FORBIDDEN",
              message: "Terminal scope denied",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const current = allowed.rows[0].status;
        const next =
          terminalAction[2] === "authorize"
            ? "AUTHORIZED"
            : terminalAction[2] === "suspend"
              ? "SUSPENDED"
              : "ACTIVE";
        const valid =
          (next === "AUTHORIZED" && current === "PENDING") ||
          (next === "SUSPENDED" &&
            (current === "ACTIVE" || current === "AUTHORIZED")) ||
          (next === "ACTIVE" && current === "SUSPENDED");
        if (!valid) {
          reply(res, 409, {
            error: {
              code: "INVALID_TERMINAL_TRANSITION",
              message: "Invalid terminal transition",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const t = await pool.query(
          "UPDATE terminals SET status=$1 WHERE id=$2 RETURNING id,status",
          [next, terminalAction[1]],
        );
        await pool.query(
          "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,$2,'TERMINAL',$3,$4)",
          [
            actorId,
            `Terminal${terminalAction[2][0].toUpperCase() + terminalAction[2].slice(1)}`,
            terminalAction[1],
            cid,
          ],
        );
        reply(res, 200, { data: t.rows[0] });
        return;
      }
      const businessAction = req.url?.match(
        /^\/api\/v1\/businesses\/([^/]+)\/(submit|approve|activate|suspend)$/,
      );
      if (req.method === "POST" && businessAction) {
        const actorId = req.headers["x-actor-id"] as string | undefined;
        if (!actorId) {
          reply(res, 401, {
            error: {
              code: "UNAUTHENTICATED",
              message: "Actor required",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const id = businessAction[1],
          action = businessAction[2];
        const b = await pool.query(
          "SELECT status FROM businesses WHERE id=$1",
          [id],
        );
        if (!b.rowCount) {
          const credentialLink = req.url?.match(
            /^\/api\/v1\/users\/([^/]+)\/credentials$/,
          );
          if (req.method === "POST" && credentialLink) {
            const actorId = req.headers["x-actor-id"] as string | undefined;
            if (!actorId) {
              reply(res, 401, {
                error: {
                  code: "UNAUTHENTICATED",
                  message: "Actor required",
                  correlation_id: cid,
                  details: {},
                },
              });
              return;
            }
            if (
              actorId !== credentialLink[1] &&
              !req.headers["x-platform-actor-id"]
            ) {
              reply(res, 403, {
                error: {
                  code: "FORBIDDEN",
                  message: "Credential scope denied",
                  correlation_id: cid,
                  details: {},
                },
              });
              return;
            }
            const input = await body(req);
            if (
              typeof input.public_reference !== "string" ||
              !input.public_reference.trim()
            ) {
              reply(res, 400, {
                error: {
                  code: "INVALID_INPUT",
                  message: "public_reference is required",
                  correlation_id: cid,
                  details: {},
                },
              });
              return;
            }
            try {
              const c = await pool.query(
                "INSERT INTO credentials (user_id,type,public_reference,status) VALUES ($1,$2,$3,'PENDING') RETURNING id,user_id,type,public_reference,status",
                [
                  credentialLink[1],
                  input.type ?? "NFC",
                  input.public_reference.trim(),
                ],
              );
              await pool.query(
                "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialLinked','CREDENTIAL',$2,$3)",
                [actorId, c.rows[0].id, cid],
              );
              reply(res, 201, { data: c.rows[0] });
            } catch (e) {
              if ((e as { code?: string }).code === "23505") {
                reply(res, 409, {
                  error: {
                    code: "CREDENTIAL_ALREADY_LINKED",
                    message: "Credential reference already linked",
                    correlation_id: cid,
                    details: {},
                  },
                });
              } else {
                throw e;
              }
            }
            return;
          }
          const credentialActivate = req.url?.match(
            /^\/api\/v1\/credentials\/([^/]+)\/activate$/,
          );
          if (req.method === "POST" && credentialActivate) {
            const actorId = req.headers["x-actor-id"] as string | undefined;
            if (!actorId) {
              reply(res, 401, {
                error: {
                  code: "UNAUTHENTICATED",
                  message: "Actor required",
                  correlation_id: cid,
                  details: {},
                },
              });
              return;
            }
            const c = await pool.query(
              "UPDATE credentials SET status='ACTIVE' WHERE id=$1 AND status='PENDING' RETURNING id,status",
              [credentialActivate[1]],
            );
            if (!c.rowCount) {
              reply(res, 409, {
                error: {
                  code: "INVALID_CREDENTIAL_TRANSITION",
                  message: "Credential is not pending",
                  correlation_id: cid,
                  details: {},
                },
              });
              return;
            }
            await pool.query(
              "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialActivated','CREDENTIAL',$2,$3)",
              [actorId, credentialActivate[1], cid],
            );
            reply(res, 200, { data: c.rows[0] });
            return;
          }
          reply(res, 404, {
            error: {
              code: "BUSINESS_NOT_FOUND",
              message: "Business not found",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const role = await pool.query(
          "SELECT role FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND status='ACTIVE'",
          [id, actorId],
        );
        const current = b.rows[0].status;
        const platform = actorId === req.headers["x-platform-actor-id"];
        const target =
          action === "submit"
            ? "PENDING_VERIFICATION"
            : action === "approve"
              ? "VERIFIED"
              : action === "activate"
                ? "ACTIVE"
                : "SUSPENDED";
        const allowed =
          (action === "submit" &&
            role.rows.some(
              (r: { role: string }) => r.role === "BUSINESS_OWNER",
            ) &&
            current === "DRAFT") ||
          (action === "approve" && platform && current === "UNDER_REVIEW") ||
          (action === "activate" && platform && current === "VERIFIED") ||
          (action === "suspend" && platform && current === "ACTIVE");
        if (!allowed) {
          reply(res, 403, {
            error: {
              code: "FORBIDDEN_OR_INVALID_TRANSITION",
              message: "Business operation denied",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        await pool.query("UPDATE businesses SET status=$1 WHERE id=$2", [
          target,
          id,
        ]);
        await pool.query(
          "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,$2,'BUSINESS',$3,$4)",
          [
            actorId,
            `Business${action[0].toUpperCase() + action.slice(1)}`,
            id,
            cid,
          ],
        );
        reply(res, 200, { data: { id, status: target } });
        return;
      }
      const credentialLink = req.url?.match(
        /^\/api\/v1\/users\/([^/]+)\/credentials$/,
      );
      if (req.method === "POST" && credentialLink) {
        const actorId = req.headers["x-actor-id"] as string | undefined;
        if (!actorId) {
          reply(res, 401, {
            error: {
              code: "UNAUTHENTICATED",
              message: "Actor required",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        if (
          actorId !== credentialLink[1] &&
          !req.headers["x-platform-actor-id"]
        ) {
          reply(res, 403, {
            error: {
              code: "FORBIDDEN",
              message: "Credential scope denied",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const input = await body(req);
        if (
          typeof input.public_reference !== "string" ||
          !input.public_reference.trim()
        ) {
          reply(res, 400, {
            error: {
              code: "INVALID_INPUT",
              message: "public_reference is required",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        try {
          const c = await pool.query(
            "INSERT INTO credentials (user_id,type,public_reference,status) VALUES ($1,$2,$3,'PENDING') RETURNING id,user_id,type,public_reference,status",
            [
              credentialLink[1],
              input.type ?? "NFC",
              input.public_reference.trim(),
            ],
          );
          await pool.query(
            "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialLinked','CREDENTIAL',$2,$3)",
            [actorId, c.rows[0].id, cid],
          );
          reply(res, 201, { data: c.rows[0] });
        } catch (e) {
          if ((e as { code?: string }).code === "23505") {
            reply(res, 409, {
              error: {
                code: "CREDENTIAL_ALREADY_LINKED",
                message: "Credential reference already linked",
                correlation_id: cid,
                details: {},
              },
            });
          } else {
            throw e;
          }
        }
        return;
      }
      const credentialActivate = req.url?.match(
        /^\/api\/v1\/credentials\/([^/]+)\/activate$/,
      );
      if (req.method === "POST" && credentialActivate) {
        const actorId = req.headers["x-actor-id"] as string | undefined;
        if (!actorId) {
          reply(res, 401, {
            error: {
              code: "UNAUTHENTICATED",
              message: "Actor required",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const c = await pool.query(
          "UPDATE credentials SET status='ACTIVE' WHERE id=$1 AND status='PENDING' RETURNING id,status",
          [credentialActivate[1]],
        );
        if (!c.rowCount) {
          reply(res, 409, {
            error: {
              code: "INVALID_CREDENTIAL_TRANSITION",
              message: "Credential is not pending",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        await pool.query(
          "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialActivated','CREDENTIAL',$2,$3)",
          [actorId, credentialActivate[1], cid],
        );
        reply(res, 200, { data: c.rows[0] });
        return;
      }
      reply(res, 404, {
        error: {
          code: "CREDENTIAL_NOT_FOUND_OR_INVALID",
          message: "Credential unavailable",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    await pool.query(
      "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialBlocked','CREDENTIAL',$2,$3)",
      [actorId, credentialId, cid],
    );
    reply(res, 200, { data: result.rows[0] });
    return;
  }
  if (req.method === "POST" && req.url === "/api/v1/businesses") {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    try {
      const input = await body(req);
      if (typeof input.name !== "string" || !input.name.trim()) {
        reply(res, 400, {
          error: {
            code: "INVALID_INPUT",
            message: "name is required",
            correlation_id: cid,
            details: {},
          },
        });
        return;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const b = await client.query(
          "INSERT INTO businesses (name,status,verification_state) VALUES ($1,'DRAFT','PENDING') RETURNING *",
          [input.name.trim()],
        );
        await client.query(
          "INSERT INTO business_memberships (business_id,user_id,role) VALUES ($1,$2,'BUSINESS_OWNER')",
          [b.rows[0].id, actorId],
        );
        await client.query(
          "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'BusinessCreated','BUSINESS',$2,$3)",
          [actorId, b.rows[0].id, cid],
        );
        await client.query("COMMIT");
        reply(res, 201, { data: b.rows[0] });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } catch {
      reply(res, 400, {
        error: {
          code: "INVALID_REQUEST",
          message: "Business could not be created",
          correlation_id: cid,
          details: {},
        },
      });
    }
    return;
  }
  const branchMatch = req.url?.match(
    /^\/api\/v1\/businesses\/([^/]+)\/branches$/,
  );
  if (req.method === "POST" && branchMatch) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const input = await body(req);
    const allowed = await pool.query(
      "SELECT 1 FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND role IN ('BUSINESS_OWNER','BUSINESS_ADMIN') AND status='ACTIVE'",
      [branchMatch[1], actorId],
    );
    if (!allowed.rowCount) {
      reply(res, 403, {
        error: {
          code: "FORBIDDEN",
          message: "Business scope denied",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const b = await pool.query(
      "INSERT INTO branches (business_id,name) VALUES ($1,$2) RETURNING *",
      [branchMatch[1], input.name],
    );
    reply(res, 201, { data: b.rows[0] });
    return;
  }
  const terminalMatch = req.url?.match(
    /^\/api\/v1\/branches\/([^/]+)\/terminals$/,
  );
  if (req.method === "POST" && terminalMatch) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const allowed = await pool.query(
      "SELECT 1 FROM business_memberships m JOIN branches b ON b.business_id=m.business_id WHERE b.id=$1 AND m.user_id=$2 AND m.role IN ('BUSINESS_OWNER','BUSINESS_ADMIN','BRANCH_MANAGER') AND m.status='ACTIVE'",
      [terminalMatch[1], actorId],
    );
    if (!allowed.rowCount) {
      reply(res, 403, {
        error: {
          code: "FORBIDDEN",
          message: "Branch scope denied",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const input = await body(req);
    const t = await pool.query(
      "INSERT INTO terminals (branch_id,terminal_type,status) VALUES ($1,$2,'PENDING') RETURNING *",
      [terminalMatch[1], input.terminal_type ?? "WEB"],
    );
    reply(res, 201, { data: t.rows[0] });
    return;
  }
  const replaceMatch = req.url?.match(
    /^\/api\/v1\/me\/credentials\/([^/]+)\/replace$/,
  );
  if (req.method === "POST" && replaceMatch) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const old = await client.query(
        "SELECT user_id,type FROM credentials WHERE id=$1 AND user_id=$2 AND status IN ('ACTIVE','BLOCKED') FOR UPDATE",
        [replaceMatch[1], actorId],
      );
      if (!old.rowCount) {
        await client.query("ROLLBACK");
        const businessAction = req.url?.match(
          /^\/api\/v1\/businesses\/([^/]+)\/(submit|approve|activate|suspend)$/,
        );
        if (req.method === "POST" && businessAction) {
          const actorId = req.headers["x-actor-id"] as string | undefined;
          if (!actorId) {
            reply(res, 401, {
              error: {
                code: "UNAUTHENTICATED",
                message: "Actor required",
                correlation_id: cid,
                details: {},
              },
            });
            return;
          }
          const id = businessAction[1],
            action = businessAction[2];
          const b = await pool.query(
            "SELECT status FROM businesses WHERE id=$1",
            [id],
          );
          if (!b.rowCount) {
            const credentialLink = req.url?.match(
              /^\/api\/v1\/users\/([^/]+)\/credentials$/,
            );
            if (req.method === "POST" && credentialLink) {
              const actorId = req.headers["x-actor-id"] as string | undefined;
              if (!actorId) {
                reply(res, 401, {
                  error: {
                    code: "UNAUTHENTICATED",
                    message: "Actor required",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              if (
                actorId !== credentialLink[1] &&
                !req.headers["x-platform-actor-id"]
              ) {
                reply(res, 403, {
                  error: {
                    code: "FORBIDDEN",
                    message: "Credential scope denied",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              const input = await body(req);
              if (
                typeof input.public_reference !== "string" ||
                !input.public_reference.trim()
              ) {
                reply(res, 400, {
                  error: {
                    code: "INVALID_INPUT",
                    message: "public_reference is required",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              try {
                const c = await pool.query(
                  "INSERT INTO credentials (user_id,type,public_reference,status) VALUES ($1,$2,$3,'PENDING') RETURNING id,user_id,type,public_reference,status",
                  [
                    credentialLink[1],
                    input.type ?? "NFC",
                    input.public_reference.trim(),
                  ],
                );
                await pool.query(
                  "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialLinked','CREDENTIAL',$2,$3)",
                  [actorId, c.rows[0].id, cid],
                );
                reply(res, 201, { data: c.rows[0] });
              } catch (e) {
                if ((e as { code?: string }).code === "23505") {
                  reply(res, 409, {
                    error: {
                      code: "CREDENTIAL_ALREADY_LINKED",
                      message: "Credential reference already linked",
                      correlation_id: cid,
                      details: {},
                    },
                  });
                } else {
                  throw e;
                }
              }
              return;
            }
            const credentialActivate = req.url?.match(
              /^\/api\/v1\/credentials\/([^/]+)\/activate$/,
            );
            if (req.method === "POST" && credentialActivate) {
              const actorId = req.headers["x-actor-id"] as string | undefined;
              if (!actorId) {
                reply(res, 401, {
                  error: {
                    code: "UNAUTHENTICATED",
                    message: "Actor required",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              const c = await pool.query(
                "UPDATE credentials SET status='ACTIVE' WHERE id=$1 AND status='PENDING' RETURNING id,status",
                [credentialActivate[1]],
              );
              if (!c.rowCount) {
                reply(res, 409, {
                  error: {
                    code: "INVALID_CREDENTIAL_TRANSITION",
                    message: "Credential is not pending",
                    correlation_id: cid,
                    details: {},
                  },
                });
                return;
              }
              await pool.query(
                "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialActivated','CREDENTIAL',$2,$3)",
                [actorId, credentialActivate[1], cid],
              );
              reply(res, 200, { data: c.rows[0] });
              return;
            }
            reply(res, 404, {
              error: {
                code: "BUSINESS_NOT_FOUND",
                message: "Business not found",
                correlation_id: cid,
                details: {},
              },
            });
            return;
          }
          const role = await pool.query(
            "SELECT role FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND status='ACTIVE'",
            [id, actorId],
          );
          const current = b.rows[0].status;
          const platform = actorId === req.headers["x-platform-actor-id"];
          const target =
            action === "submit"
              ? "PENDING_VERIFICATION"
              : action === "approve"
                ? "VERIFIED"
                : action === "activate"
                  ? "ACTIVE"
                  : "SUSPENDED";
          const allowed =
            (action === "submit" &&
              role.rows.some(
                (r: { role: string }) => r.role === "BUSINESS_OWNER",
              ) &&
              current === "DRAFT") ||
            (action === "approve" && platform && current === "UNDER_REVIEW") ||
            (action === "activate" && platform && current === "VERIFIED") ||
            (action === "suspend" && platform && current === "ACTIVE");
          if (!allowed) {
            reply(res, 403, {
              error: {
                code: "FORBIDDEN_OR_INVALID_TRANSITION",
                message: "Business operation denied",
                correlation_id: cid,
                details: {},
              },
            });
            return;
          }
          await pool.query("UPDATE businesses SET status=$1 WHERE id=$2", [
            target,
            id,
          ]);
          await pool.query(
            "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,$2,'BUSINESS',$3,$4)",
            [
              actorId,
              `Business${action[0].toUpperCase() + action.slice(1)}`,
              id,
              cid,
            ],
          );
          reply(res, 200, { data: { id, status: target } });
          return;
        }
        const credentialLink = req.url?.match(
          /^\/api\/v1\/users\/([^/]+)\/credentials$/,
        );
        if (req.method === "POST" && credentialLink) {
          const actorId = req.headers["x-actor-id"] as string | undefined;
          if (!actorId) {
            reply(res, 401, {
              error: {
                code: "UNAUTHENTICATED",
                message: "Actor required",
                correlation_id: cid,
                details: {},
              },
            });
            return;
          }
          if (
            actorId !== credentialLink[1] &&
            !req.headers["x-platform-actor-id"]
          ) {
            reply(res, 403, {
              error: {
                code: "FORBIDDEN",
                message: "Credential scope denied",
                correlation_id: cid,
                details: {},
              },
            });
            return;
          }
          const input = await body(req);
          if (
            typeof input.public_reference !== "string" ||
            !input.public_reference.trim()
          ) {
            reply(res, 400, {
              error: {
                code: "INVALID_INPUT",
                message: "public_reference is required",
                correlation_id: cid,
                details: {},
              },
            });
            return;
          }
          try {
            const c = await pool.query(
              "INSERT INTO credentials (user_id,type,public_reference,status) VALUES ($1,$2,$3,'PENDING') RETURNING id,user_id,type,public_reference,status",
              [
                credentialLink[1],
                input.type ?? "NFC",
                input.public_reference.trim(),
              ],
            );
            await pool.query(
              "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialLinked','CREDENTIAL',$2,$3)",
              [actorId, c.rows[0].id, cid],
            );
            reply(res, 201, { data: c.rows[0] });
          } catch (e) {
            if ((e as { code?: string }).code === "23505") {
              reply(res, 409, {
                error: {
                  code: "CREDENTIAL_ALREADY_LINKED",
                  message: "Credential reference already linked",
                  correlation_id: cid,
                  details: {},
                },
              });
            } else {
              throw e;
            }
          }
          return;
        }
        const credentialActivate = req.url?.match(
          /^\/api\/v1\/credentials\/([^/]+)\/activate$/,
        );
        if (req.method === "POST" && credentialActivate) {
          const actorId = req.headers["x-actor-id"] as string | undefined;
          if (!actorId) {
            reply(res, 401, {
              error: {
                code: "UNAUTHENTICATED",
                message: "Actor required",
                correlation_id: cid,
                details: {},
              },
            });
            return;
          }
          const c = await pool.query(
            "UPDATE credentials SET status='ACTIVE' WHERE id=$1 AND status='PENDING' RETURNING id,status",
            [credentialActivate[1]],
          );
          if (!c.rowCount) {
            reply(res, 409, {
              error: {
                code: "INVALID_CREDENTIAL_TRANSITION",
                message: "Credential is not pending",
                correlation_id: cid,
                details: {},
              },
            });
            return;
          }
          await pool.query(
            "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialActivated','CREDENTIAL',$2,$3)",
            [actorId, credentialActivate[1], cid],
          );
          reply(res, 200, { data: c.rows[0] });
          return;
        }
        reply(res, 404, {
          error: {
            code: "CREDENTIAL_NOT_FOUND",
            message: "Credential unavailable",
            correlation_id: cid,
            details: {},
          },
        });
        return;
      }
      const ref = `cred_${crypto.randomUUID()}`;
      const fresh = await client.query(
        "INSERT INTO credentials (user_id,type,public_reference,status) VALUES ($1,$2,$3,'ACTIVE') RETURNING id,public_reference,status",
        [actorId, old.rows[0].type, ref],
      );
      await client.query(
        "UPDATE credentials SET status='REPLACED',replaced_by_id=$1 WHERE id=$2",
        [fresh.rows[0].id, replaceMatch[1]],
      );
      await client.query(
        "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialReplaced','CREDENTIAL',$2,$3)",
        [actorId, replaceMatch[1], cid],
      );
      await client.query("COMMIT");
      reply(res, 201, { data: fresh.rows[0] });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    return;
  }
  const terminalAction = req.url?.match(
    /^\/api\/v1\/terminals\/([^/]+)\/(authorize|suspend|resume)$/,
  );
  if (req.method === "POST" && terminalAction) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const allowed = await pool.query(
      "SELECT t.status,m.business_id,m.role FROM terminals t JOIN branches b ON b.id=t.branch_id JOIN business_memberships m ON m.business_id=b.business_id WHERE t.id=$1 AND m.user_id=$2 AND m.role IN ('BUSINESS_OWNER','BUSINESS_ADMIN','BRANCH_MANAGER') AND m.status='ACTIVE'",
      [terminalAction[1], actorId],
    );
    if (!allowed.rowCount) {
      reply(res, 403, {
        error: {
          code: "FORBIDDEN",
          message: "Terminal scope denied",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const current = allowed.rows[0].status;
    const next =
      terminalAction[2] === "authorize"
        ? "AUTHORIZED"
        : terminalAction[2] === "suspend"
          ? "SUSPENDED"
          : "ACTIVE";
    const valid =
      (next === "AUTHORIZED" && current === "PENDING") ||
      (next === "SUSPENDED" &&
        (current === "ACTIVE" || current === "AUTHORIZED")) ||
      (next === "ACTIVE" && current === "SUSPENDED");
    if (!valid) {
      reply(res, 409, {
        error: {
          code: "INVALID_TERMINAL_TRANSITION",
          message: "Invalid terminal transition",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const t = await pool.query(
      "UPDATE terminals SET status=$1 WHERE id=$2 RETURNING id,status",
      [next, terminalAction[1]],
    );
    await pool.query(
      "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,$2,'TERMINAL',$3,$4)",
      [
        actorId,
        `Terminal${terminalAction[2][0].toUpperCase() + terminalAction[2].slice(1)}`,
        terminalAction[1],
        cid,
      ],
    );
    reply(res, 200, { data: t.rows[0] });
    return;
  }
  const businessAction = req.url?.match(
    /^\/api\/v1\/businesses\/([^/]+)\/(submit|approve|activate|suspend)$/,
  );
  if (req.method === "POST" && businessAction) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const id = businessAction[1],
      action = businessAction[2];
    const b = await pool.query("SELECT status FROM businesses WHERE id=$1", [
      id,
    ]);
    if (!b.rowCount) {
      const credentialLink = req.url?.match(
        /^\/api\/v1\/users\/([^/]+)\/credentials$/,
      );
      if (req.method === "POST" && credentialLink) {
        const actorId = req.headers["x-actor-id"] as string | undefined;
        if (!actorId) {
          reply(res, 401, {
            error: {
              code: "UNAUTHENTICATED",
              message: "Actor required",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        if (
          actorId !== credentialLink[1] &&
          !req.headers["x-platform-actor-id"]
        ) {
          reply(res, 403, {
            error: {
              code: "FORBIDDEN",
              message: "Credential scope denied",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const input = await body(req);
        if (
          typeof input.public_reference !== "string" ||
          !input.public_reference.trim()
        ) {
          reply(res, 400, {
            error: {
              code: "INVALID_INPUT",
              message: "public_reference is required",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        try {
          const c = await pool.query(
            "INSERT INTO credentials (user_id,type,public_reference,status) VALUES ($1,$2,$3,'PENDING') RETURNING id,user_id,type,public_reference,status",
            [
              credentialLink[1],
              input.type ?? "NFC",
              input.public_reference.trim(),
            ],
          );
          await pool.query(
            "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialLinked','CREDENTIAL',$2,$3)",
            [actorId, c.rows[0].id, cid],
          );
          reply(res, 201, { data: c.rows[0] });
        } catch (e) {
          if ((e as { code?: string }).code === "23505") {
            reply(res, 409, {
              error: {
                code: "CREDENTIAL_ALREADY_LINKED",
                message: "Credential reference already linked",
                correlation_id: cid,
                details: {},
              },
            });
          } else {
            throw e;
          }
        }
        return;
      }
      const credentialActivate = req.url?.match(
        /^\/api\/v1\/credentials\/([^/]+)\/activate$/,
      );
      if (req.method === "POST" && credentialActivate) {
        const actorId = req.headers["x-actor-id"] as string | undefined;
        if (!actorId) {
          reply(res, 401, {
            error: {
              code: "UNAUTHENTICATED",
              message: "Actor required",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        const c = await pool.query(
          "UPDATE credentials SET status='ACTIVE' WHERE id=$1 AND status='PENDING' RETURNING id,status",
          [credentialActivate[1]],
        );
        if (!c.rowCount) {
          reply(res, 409, {
            error: {
              code: "INVALID_CREDENTIAL_TRANSITION",
              message: "Credential is not pending",
              correlation_id: cid,
              details: {},
            },
          });
          return;
        }
        await pool.query(
          "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialActivated','CREDENTIAL',$2,$3)",
          [actorId, credentialActivate[1], cid],
        );
        reply(res, 200, { data: c.rows[0] });
        return;
      }
      reply(res, 404, {
        error: {
          code: "BUSINESS_NOT_FOUND",
          message: "Business not found",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const role = await pool.query(
      "SELECT role FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND status='ACTIVE'",
      [id, actorId],
    );
    const current = b.rows[0].status;
    const platform = actorId === req.headers["x-platform-actor-id"];
    const target =
      action === "submit"
        ? "PENDING_VERIFICATION"
        : action === "approve"
          ? "VERIFIED"
          : action === "activate"
            ? "ACTIVE"
            : "SUSPENDED";
    const allowed =
      (action === "submit" &&
        role.rows.some((r: { role: string }) => r.role === "BUSINESS_OWNER") &&
        current === "DRAFT") ||
      (action === "approve" && platform && current === "UNDER_REVIEW") ||
      (action === "activate" && platform && current === "VERIFIED") ||
      (action === "suspend" && platform && current === "ACTIVE");
    if (!allowed) {
      reply(res, 403, {
        error: {
          code: "FORBIDDEN_OR_INVALID_TRANSITION",
          message: "Business operation denied",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    await pool.query("UPDATE businesses SET status=$1 WHERE id=$2", [
      target,
      id,
    ]);
    await pool.query(
      "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,$2,'BUSINESS',$3,$4)",
      [
        actorId,
        `Business${action[0].toUpperCase() + action.slice(1)}`,
        id,
        cid,
      ],
    );
    reply(res, 200, { data: { id, status: target } });
    return;
  }
  const credentialLink = req.url?.match(
    /^\/api\/v1\/users\/([^/]+)\/credentials$/,
  );
  if (req.method === "POST" && credentialLink) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    if (actorId !== credentialLink[1] && !req.headers["x-platform-actor-id"]) {
      reply(res, 403, {
        error: {
          code: "FORBIDDEN",
          message: "Credential scope denied",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const input = await body(req);
    if (
      typeof input.public_reference !== "string" ||
      !input.public_reference.trim()
    ) {
      reply(res, 400, {
        error: {
          code: "INVALID_INPUT",
          message: "public_reference is required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    try {
      const c = await pool.query(
        "INSERT INTO credentials (user_id,type,public_reference,status) VALUES ($1,$2,$3,'PENDING') RETURNING id,user_id,type,public_reference,status",
        [credentialLink[1], input.type ?? "NFC", input.public_reference.trim()],
      );
      await pool.query(
        "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialLinked','CREDENTIAL',$2,$3)",
        [actorId, c.rows[0].id, cid],
      );
      reply(res, 201, { data: c.rows[0] });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        reply(res, 409, {
          error: {
            code: "CREDENTIAL_ALREADY_LINKED",
            message: "Credential reference already linked",
            correlation_id: cid,
            details: {},
          },
        });
      } else {
        throw e;
      }
    }
    return;
  }
  const credentialActivate = req.url?.match(
    /^\/api\/v1\/credentials\/([^/]+)\/activate$/,
  );
  if (req.method === "POST" && credentialActivate) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const c = await pool.query(
      "UPDATE credentials SET status='ACTIVE' WHERE id=$1 AND status='PENDING' RETURNING id,status",
      [credentialActivate[1]],
    );
    if (!c.rowCount) {
      reply(res, 409, {
        error: {
          code: "INVALID_CREDENTIAL_TRANSITION",
          message: "Credential is not pending",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    await pool.query(
      "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'CredentialActivated','CREDENTIAL',$2,$3)",
      [actorId, credentialActivate[1], cid],
    );
    reply(res, 200, { data: c.rows[0] });
    return;
  }
  if (req.method === "GET" && req.url === "/api/v1/control/audit") {
    const platformActor = req.headers["x-platform-actor-id"] as
      | string
      | undefined;
    if (!platformActor) {
      reply(res, 403, {
        error: {
          code: "FORBIDDEN",
          message: "Platform scope required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const events = await pool.query(
      "SELECT id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,created_at FROM audit_events ORDER BY created_at DESC LIMIT 100",
    );
    reply(res, 200, { data: events.rows });
    return;
  }
  const catalogProduct = req.url?.match(
    /^\/api\/v1\/businesses\/([^/]+)\/products$/,
  );
  if (req.method === "POST" && catalogProduct) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    const input = await body(req);
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    if (
      typeof input.name !== "string" ||
      !input.name.trim() ||
      !["PRODUCT", "SERVICE"].includes(input.type ?? "PRODUCT")
    ) {
      reply(res, 400, {
        error: {
          code: "INVALID_INPUT",
          message: "name and valid type are required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const membership = await pool.query(
      "SELECT id FROM business_memberships WHERE business_id=$1 AND user_id=$2 AND status='ACTIVE' AND role IN ('BUSINESS_OWNER','BUSINESS_ADMIN') LIMIT 1",
      [catalogProduct[1], actorId],
    );
    if (!membership.rowCount) {
      reply(res, 403, {
        error: {
          code: "FORBIDDEN",
          message: "Catalog scope denied",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const product = await pool.query(
      "INSERT INTO products (business_id,type,name,description,status) VALUES ($1,$2,$3,$4,'ACTIVE') RETURNING id,business_id,type,name,description,status",
      [
        catalogProduct[1],
        input.type ?? "PRODUCT",
        input.name.trim(),
        typeof input.description === "string" ? input.description : null,
      ],
    );
    reply(res, 201, { data: product.rows[0] });
    return;
  }
  const catalogVariant = req.url?.match(
    /^\/api\/v1\/products\/([^/]+)\/variants$/,
  );
  if (req.method === "POST" && catalogVariant) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    const input = await body(req);
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    if (typeof input.sku !== "string" || !input.sku.trim()) {
      reply(res, 400, {
        error: {
          code: "INVALID_INPUT",
          message: "sku is required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const owner = await pool.query(
      "SELECT m.id FROM business_memberships m JOIN products p ON p.business_id=m.business_id WHERE p.id=$1 AND m.user_id=$2 AND m.status='ACTIVE' AND m.role IN ('BUSINESS_OWNER','BUSINESS_ADMIN') LIMIT 1",
      [catalogVariant[1], actorId],
    );
    if (!owner.rowCount) {
      reply(res, 403, {
        error: {
          code: "FORBIDDEN",
          message: "Catalog scope denied",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    try {
      const variant = await pool.query(
        "INSERT INTO product_variants (product_id,sku,attributes_json,status) VALUES ($1,$2,$3,'ACTIVE') RETURNING id,product_id,sku,attributes_json,status",
        [catalogVariant[1], input.sku.trim(), input.attributes ?? {}],
      );
      reply(res, 201, { data: variant.rows[0] });
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        reply(res, 409, {
          error: {
            code: "SKU_ALREADY_EXISTS",
            message: "SKU already exists",
            correlation_id: cid,
            details: {},
          },
        });
      else throw error;
    }
    return;
  }
  const catalogPrice = req.url?.match(/^\/api\/v1\/variants\/([^/]+)\/prices$/);
  if (req.method === "POST" && catalogPrice) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    const input = await body(req);
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    if (
      typeof input.amount_minor !== "number" ||
      !Number.isSafeInteger(input.amount_minor) ||
      input.amount_minor <= 0 ||
      typeof input.branch_id !== "string"
    ) {
      reply(res, 400, {
        error: {
          code: "INVALID_INPUT",
          message: "positive amount_minor and branch_id are required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const owner = await pool.query(
      "SELECT m.id FROM business_memberships m JOIN product_variants v ON v.id=$1 JOIN products p ON p.id=v.product_id JOIN branches b ON b.id=$2 AND b.business_id=p.business_id WHERE m.business_id=p.business_id AND m.user_id=$3 AND m.status='ACTIVE' AND m.role IN ('BUSINESS_OWNER','BUSINESS_ADMIN') LIMIT 1",
      [catalogPrice[1], input.branch_id, actorId],
    );
    if (!owner.rowCount) {
      reply(res, 403, {
        error: {
          code: "FORBIDDEN",
          message: "Catalog scope denied",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const price = await pool.query(
      "INSERT INTO prices (variant_id,branch_id,amount_minor,currency,valid_from) VALUES ($1,$2,$3,$4,now()) RETURNING id,variant_id,branch_id,amount_minor,currency,valid_from",
      [
        catalogPrice[1],
        input.branch_id,
        input.amount_minor.toString(),
        input.currency ?? "COP",
      ],
    );
    reply(res, 201, {
      data: {
        ...price.rows[0],
        amount_minor: String(price.rows[0].amount_minor),
      },
    });
    return;
  }
  const inventoryAdjust = req.url?.match(
    /^\/api\/v1\/branches\/([^/]+)\/inventory$/,
  );
  if (req.method === "POST" && inventoryAdjust) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    const input = await body(req);
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    if (
      typeof input.variant_id !== "string" ||
      !Number.isInteger(input.quantity) ||
      input.quantity < 0
    ) {
      reply(res, 400, {
        error: {
          code: "INVALID_INPUT",
          message: "variant_id and non-negative quantity are required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const owner = await pool.query(
      "SELECT m.id FROM business_memberships m JOIN branches b ON b.id=$1 AND b.business_id=m.business_id WHERE m.user_id=$2 AND m.status='ACTIVE' AND m.role IN ('BUSINESS_OWNER','BUSINESS_ADMIN','BRANCH_MANAGER') LIMIT 1",
      [inventoryAdjust[1], actorId],
    );
    if (!owner.rowCount) {
      reply(res, 403, {
        error: {
          code: "FORBIDDEN",
          message: "Inventory scope denied",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const balance = await pool.query(
      "INSERT INTO inventory_balances (variant_id,branch_id,quantity) VALUES ($1,$2,$3) ON CONFLICT (variant_id,branch_id) DO UPDATE SET quantity=EXCLUDED.quantity,updated_at=now() RETURNING variant_id,branch_id,quantity,updated_at",
      [input.variant_id, inventoryAdjust[1], input.quantity],
    );
    reply(res, 200, { data: balance.rows[0] });
    return;
  }
  if (req.method === "POST" && req.url === "/api/v1/sales") {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const input = await body(req);
    if (
      typeof input.business_id !== "string" ||
      typeof input.branch_id !== "string" ||
      typeof input.terminal_id !== "string" ||
      !Array.isArray(input.lines) ||
      input.lines.length === 0
    ) {
      reply(res, 400, {
        error: {
          code: "INVALID_INPUT",
          message: "business_id, branch_id, terminal_id and lines are required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const scope = await client.query(
        `SELECT m.id AS membership_id, m.role, b.status AS business_status, br.status AS branch_status, t.status AS terminal_status
           FROM business_memberships m
           JOIN businesses b ON b.id=m.business_id
           JOIN branches br ON br.id=$2 AND br.business_id=b.id
           JOIN terminals t ON t.id=$3 AND t.branch_id=br.id
          WHERE m.business_id=$1 AND m.user_id=$4 AND m.status='ACTIVE'
            AND (m.role IN ('BUSINESS_OWNER','BUSINESS_ADMIN','BRANCH_MANAGER','CASHIER'))
            AND (m.role IN ('BUSINESS_OWNER','BUSINESS_ADMIN') OR EXISTS
                 (SELECT 1 FROM membership_branch_scopes s WHERE s.membership_id=m.id AND s.branch_id=br.id))
          LIMIT 1`,
        [input.business_id, input.branch_id, input.terminal_id, actorId],
      );
      const authorized =
        scope.rows[0] &&
        scope.rows[0].business_status === "ACTIVE" &&
        scope.rows[0].branch_status === "ACTIVE" &&
        scope.rows[0].terminal_status === "AUTHORIZED";
      if (!authorized) {
        await client.query("ROLLBACK");
        reply(res, 403, {
          error: {
            code: "SALE_SCOPE_DENIED",
            message: "Actor or terminal is not authorized",
            correlation_id: cid,
            details: {},
          },
        });
        return;
      }
      const priced: Array<{
        variantId: string;
        description: string;
        quantity: number;
        unitPrice: bigint;
        total: bigint;
      }> = [];
      for (const line of input.lines) {
        if (
          typeof line?.variant_id !== "string" ||
          !Number.isInteger(line.quantity) ||
          line.quantity <= 0
        )
          throw new Error("INVALID_LINE");
        const row = await client.query(
          `SELECT pv.id, p.name, pr.amount_minor, pr.currency
             FROM product_variants pv JOIN products p ON p.id=pv.product_id
             JOIN prices pr ON pr.variant_id=pv.id
            WHERE pv.id=$1 AND p.business_id=$2 AND pv.status='ACTIVE' AND p.status='ACTIVE'
              AND (pr.branch_id=$3 OR pr.branch_id IS NULL)
              AND pr.valid_from <= now() AND (pr.valid_to IS NULL OR pr.valid_to > now())
            ORDER BY (pr.branch_id IS NULL), pr.valid_from DESC LIMIT 1`,
          [line.variant_id, input.business_id, input.branch_id],
        );
        if (!row.rowCount) throw new Error("PRICE_NOT_FOUND");
        const unitPrice = BigInt(row.rows[0].amount_minor);
        const total = unitPrice * BigInt(line.quantity);
        priced.push({
          variantId: line.variant_id,
          description: row.rows[0].name,
          quantity: line.quantity,
          unitPrice,
          total,
        });
      }
      const subtotal = priced.reduce((sum, line) => sum + line.total, 0n);
      const sale = await client.query(
        `INSERT INTO sales (business_id,branch_id,terminal_id,cashier_membership_id,customer_user_id,status,subtotal_minor,total_minor,currency)
         VALUES ($1,$2,$3,$4,$5,'COMPLETED',$6,$6,'COP') RETURNING id,status,subtotal_minor,total_minor,currency,occurred_at`,
        [
          input.business_id,
          input.branch_id,
          input.terminal_id,
          scope.rows[0].membership_id,
          typeof input.customer_user_id === "string"
            ? input.customer_user_id
            : null,
          subtotal.toString(),
        ],
      );
      for (const line of priced)
        await client.query(
          `INSERT INTO sale_lines (sale_id,variant_id,description_snapshot,quantity,unit_price_minor,total_minor) VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            sale.rows[0].id,
            line.variantId,
            line.description,
            line.quantity,
            line.unitPrice.toString(),
            line.total.toString(),
          ],
        );
      await client.query(
        "INSERT INTO cash_payments (sale_id,amount_minor,currency,status) VALUES ($1,$2,'COP','CAPTURED')",
        [sale.rows[0].id, subtotal.toString()],
      );
      const snapshot = {
        sale_id: sale.rows[0].id,
        currency: "COP",
        subtotal_minor: subtotal.toString(),
        total_minor: subtotal.toString(),
        lines: priced.map((line) => ({
          variant_id: line.variantId,
          description: line.description,
          quantity: line.quantity,
          unit_price_minor: line.unitPrice.toString(),
          total_minor: line.total.toString(),
        })),
      };
      const receipt = await client.query(
        `INSERT INTO receipts (sale_id,receipt_number,snapshot_json) VALUES ($1,$2,$3) RETURNING id,receipt_number,status,snapshot_json,issued_at`,
        [sale.rows[0].id, `VT-${sale.rows[0].id}`, JSON.stringify(snapshot)],
      );
      if (typeof input.customer_user_id === "string") {
        await client.query(
          "INSERT INTO review_eligibilities (user_id,business_id,sale_id,status) VALUES ($1,$2,$3,'AVAILABLE') ON CONFLICT (sale_id) DO NOTHING",
          [input.customer_user_id, input.business_id, sale.rows[0].id],
        );
      }
      await client.query(
        "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id,metadata_json) VALUES ('USER',$1,'CashSaleRecorded','SALE',$2,$3,$4)",
        [
          actorId,
          sale.rows[0].id,
          cid,
          JSON.stringify({ total_minor: subtotal.toString() }),
        ],
      );
      await client.query("COMMIT");
      reply(res, 201, {
        data: {
          sale: {
            ...sale.rows[0],
            subtotal_minor: subtotal.toString(),
            total_minor: subtotal.toString(),
          },
          receipt: receipt.rows[0],
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      const code =
        error instanceof Error && error.message === "PRICE_NOT_FOUND"
          ? "PRICE_NOT_FOUND"
          : error instanceof Error && error.message === "INVALID_LINE"
            ? "INVALID_INPUT"
            : undefined;
      if (code)
        reply(res, 400, {
          error: {
            code,
            message:
              code === "PRICE_NOT_FOUND"
                ? "No active price for variant"
                : "Invalid sale line",
            correlation_id: cid,
            details: {},
          },
        });
      else throw error;
    } finally {
      client.release();
    }
    return;
  }
  const reviewLink = req.url?.match(
    /^\/api\/v1\/review-eligibilities\/([^/]+)\/review$/,
  );
  if (req.method === "POST" && reviewLink) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    const input = await body(req);
    if (!actorId) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    if (
      !Number.isInteger(input.rating) ||
      input.rating < 1 ||
      input.rating > 5
    ) {
      reply(res, 400, {
        error: {
          code: "INVALID_INPUT",
          message: "rating must be between 1 and 5",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const eligibility = await client.query(
        "SELECT id,user_id,status FROM review_eligibilities WHERE id=$1 FOR UPDATE",
        [reviewLink[1]],
      );
      if (
        !eligibility.rowCount ||
        eligibility.rows[0].user_id !== actorId ||
        eligibility.rows[0].status !== "AVAILABLE"
      ) {
        await client.query("ROLLBACK");
        reply(res, 403, {
          error: {
            code: "REVIEW_NOT_ELIGIBLE",
            message: "Review eligibility is unavailable",
            correlation_id: cid,
            details: {},
          },
        });
        return;
      }
      const review = await client.query(
        "INSERT INTO reviews (eligibility_id,rating,comment,status) VALUES ($1,$2,$3,'PUBLISHED') RETURNING id,eligibility_id,rating,comment,status,created_at",
        [
          reviewLink[1],
          input.rating,
          typeof input.comment === "string" ? input.comment : null,
        ],
      );
      await client.query(
        "UPDATE review_eligibilities SET status='CONSUMED' WHERE id=$1",
        [reviewLink[1]],
      );
      await client.query("COMMIT");
      reply(res, 201, { data: review.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return;
  }
  const businessReviews = req.url?.match(
    /^\/api\/v1\/businesses\/([^/]+)\/reviews$/,
  );
  if (req.method === "GET" && businessReviews) {
    const reviews = await pool.query(
      "SELECT r.id,r.rating,r.comment,r.status,r.created_at FROM reviews r JOIN review_eligibilities e ON e.id=r.eligibility_id WHERE e.business_id=$1 AND r.status='PUBLISHED' ORDER BY r.created_at DESC LIMIT 100",
      [businessReviews[1]],
    );
    reply(res, 200, { data: reviews.rows });
    return;
  }
  if (req.method === "POST" && req.url === "/api/v1/me/topups") {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    const input = await body(req);
    if (!actorId || !idempotencyKey) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor and idempotency-key required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    if (!Number.isSafeInteger(input.amount_minor) || input.amount_minor <= 0) {
      reply(res, 400, {
        error: {
          code: "INVALID_INPUT",
          message: "positive amount_minor is required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        "SELECT id,user_id,amount_minor,currency,status FROM topups WHERE idempotency_key=$1",
        [idempotencyKey],
      );
      if (existing.rowCount) {
        await client.query("ROLLBACK");
        reply(res, 200, { data: existing.rows[0], idempotent: true });
        return;
      }
      const account = await client.query(
        "INSERT INTO financial_accounts (owner_type,owner_id,account_type,currency) VALUES ('USER',$1,'USER_AVAILABLE',$2) ON CONFLICT (owner_type,owner_id,account_type,currency) DO UPDATE SET status='ACTIVE' RETURNING id",
        [actorId, input.currency ?? "COP"],
      );
      const control = await client.query(
        "INSERT INTO financial_accounts (owner_type,owner_id,account_type,currency) VALUES ('SYSTEM',$1,'VEMTAS_REVENUE',$2) ON CONFLICT (owner_type,owner_id,account_type,currency) DO UPDATE SET status='ACTIVE' RETURNING id",
        [actorId, input.currency ?? "COP"],
      );
      const topup = await client.query(
        "INSERT INTO topups (user_id,provider,amount_minor,currency,status,external_reference,idempotency_key) VALUES ($1,'MOCK',$2,$3,'POSTED',$4,$5) RETURNING id,user_id,amount_minor,currency,status,created_at",
        [
          actorId,
          input.amount_minor.toString(),
          input.currency ?? "COP",
          `mock-${idempotencyKey}`,
          idempotencyKey,
        ],
      );
      const txn = await client.query(
        "INSERT INTO ledger_transactions (transaction_type,reference_type,reference_id,idempotency_key) VALUES ('TOPUP','TOPUP',$1,$2) RETURNING id",
        [topup.rows[0].id, idempotencyKey],
      );
      await client.query(
        "INSERT INTO ledger_entries (ledger_transaction_id,financial_account_id,direction,amount_minor,currency) VALUES ($1,$2,'DEBIT',$3,$4),($1,$5,'CREDIT',$3,$4)",
        [
          txn.rows[0].id,
          control.rows[0].id,
          input.amount_minor.toString(),
          input.currency ?? "COP",
          account.rows[0].id,
        ],
      );
      await client.query("COMMIT");
      reply(res, 201, { data: topup.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "23505")
        reply(res, 409, {
          error: {
            code: "IDEMPOTENCY_COLLISION",
            message: "Idempotency key collision",
            correlation_id: cid,
            details: {},
          },
        });
      else throw error;
    } finally {
      client.release();
    }
    return;
  }
  const refundLink = req.url?.match(/^\/api\/v1\/payments\/([^/]+)\/refunds$/);
  if (req.method === "POST" && refundLink) {
    const actorId = req.headers["x-actor-id"] as string | undefined;
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    const input = await body(req);
    if (!actorId || !idempotencyKey) {
      reply(res, 401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "Actor and idempotency-key required",
          correlation_id: cid,
          details: {},
        },
      });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        "SELECT id,original_payment_id,amount_minor,reason_code,status,created_at FROM refunds WHERE idempotency_key=$1",
        [idempotencyKey],
      );
      if (existing.rowCount) {
        await client.query("ROLLBACK");
        reply(res, 200, { data: existing.rows[0], idempotent: true });
        return;
      }
      const payment = await client.query(
        "SELECT cp.id,cp.amount_minor,cp.currency,s.customer_user_id FROM cash_payments cp JOIN sales s ON s.id=cp.sale_id WHERE cp.id=$1 AND cp.status='CAPTURED' FOR UPDATE",
        [refundLink[1]],
      );
      if (!payment.rowCount) {
        await client.query("ROLLBACK");
        reply(res, 404, {
          error: {
            code: "PAYMENT_NOT_FOUND",
            message: "Captured payment not found",
            correlation_id: cid,
            details: {},
          },
        });
        return;
      }
      const amount = Number(input.amount_minor ?? payment.rows[0].amount_minor);
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        await client.query("ROLLBACK");
        reply(res, 400, {
          error: {
            code: "INVALID_INPUT",
            message: "positive amount_minor is required",
            correlation_id: cid,
            details: {},
          },
        });
        return;
      }
      const refunded = await client.query(
        "SELECT COALESCE(sum(amount_minor),0)::bigint AS total FROM refunds WHERE original_payment_id=$1 AND status='POSTED'",
        [refundLink[1]],
      );
      if (
        BigInt(refunded.rows[0].total) + BigInt(amount) >
        BigInt(payment.rows[0].amount_minor)
      ) {
        await client.query("ROLLBACK");
        reply(res, 409, {
          error: {
            code: "REFUND_EXCEEDS_PAYMENT",
            message: "Refund exceeds captured payment",
            correlation_id: cid,
            details: {},
          },
        });
        return;
      }
      const refund = await client.query(
        "INSERT INTO refunds (original_payment_id,amount_minor,reason_code,status,idempotency_key) VALUES ($1,$2,$3,'POSTED',$4) RETURNING id,original_payment_id,amount_minor,reason_code,status,created_at",
        [
          refundLink[1],
          amount.toString(),
          typeof input.reason_code === "string"
            ? input.reason_code
            : "CUSTOMER_REQUEST",
          idempotencyKey,
        ],
      );
      const userId = payment.rows[0].customer_user_id ?? actorId;
      const userAccount = await client.query(
        "INSERT INTO financial_accounts (owner_type,owner_id,account_type,currency) VALUES ('USER',$1,'USER_AVAILABLE',$2) ON CONFLICT (owner_type,owner_id,account_type,currency) DO UPDATE SET status='ACTIVE' RETURNING id",
        [userId, payment.rows[0].currency],
      );
      const revenue = await client.query(
        "INSERT INTO financial_accounts (owner_type,owner_id,account_type,currency) VALUES ('SYSTEM',$1,'VEMTAS_REVENUE',$2) ON CONFLICT (owner_type,owner_id,account_type,currency) DO UPDATE SET status='ACTIVE' RETURNING id",
        [actorId, payment.rows[0].currency],
      );
      const txn = await client.query(
        "INSERT INTO ledger_transactions (transaction_type,reference_type,reference_id,idempotency_key) VALUES ('REFUND','REFUND',$1,$2) RETURNING id",
        [refund.rows[0].id, idempotencyKey],
      );
      await client.query(
        "INSERT INTO ledger_entries (ledger_transaction_id,financial_account_id,direction,amount_minor,currency) VALUES ($1,$2,'DEBIT',$3,$4),($1,$5,'CREDIT',$3,$4)",
        [
          txn.rows[0].id,
          revenue.rows[0].id,
          amount.toString(),
          payment.rows[0].currency,
          userAccount.rows[0].id,
        ],
      );
      await client.query("COMMIT");
      reply(res, 201, { data: refund.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "23505")
        reply(res, 409, {
          error: {
            code: "IDEMPOTENCY_COLLISION",
            message: "Idempotency key collision",
            correlation_id: cid,
            details: {},
          },
        });
      else throw error;
    } finally {
      client.release();
    }
    return;
  }
  reply(res, 404, {
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
      correlation_id: cid,
      details: {},
    },
  });
});
server.listen(env.apiPort, () => log("api_started", { port: env.apiPort }));
process.on("SIGTERM", () => server.close(() => pool.end()));
