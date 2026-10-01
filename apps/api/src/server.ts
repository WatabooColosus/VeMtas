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
