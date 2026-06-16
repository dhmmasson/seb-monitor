/**
 * Docker integration tests — verifies the Docker image builds and runs correctly.
 * Requires Docker to be installed and running.
 *
 * Run: deno test --allow-run --allow-read --allow-net tests/docker_test.ts
 */
import { assertEquals, assertStringIncludes } from "@std/assert";

const IMAGE_NAME = "seb-monitor:test";
const CONTAINER_NAME = "seb-monitor-test";
const PORT = 8787; // Use a non-standard port to avoid conflicts
const HEALTH_URL = `http://localhost:${PORT}/health`;
const CLIENT_JS_URL = `http://localhost:${PORT}/seb-monitor.js`;

/** Run a shell command and return { success, stdout, stderr }. */
async function run(
  cmd: string[],
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const command = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  return {
    success: output.success,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
  };
}

/** Wait for a URL to respond, retrying up to maxAttempts times. */
async function waitForUrl(
  url: string,
  maxAttempts = 30,
  delayMs = 1000,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Connection refused — container not ready yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

Deno.test({
  name: "docker: Dockerfile exists at project root",
  fn() {
    const stat = Deno.statSync("Dockerfile");
    assertEquals(stat.isFile, true, "Dockerfile should exist at project root");
  },
});

Deno.test({
  name: "docker: docker-compose.yml exists at project root",
  fn() {
    const stat = Deno.statSync("docker-compose.yml");
    assertEquals(
      stat.isFile,
      true,
      "docker-compose.yml should exist at project root",
    );
  },
});

Deno.test({
  name: "docker: .dockerignore exists at project root",
  fn() {
    const stat = Deno.statSync(".dockerignore");
    assertEquals(
      stat.isFile,
      true,
      ".dockerignore should exist at project root",
    );
  },
});

Deno.test({
  name: "docker: image builds successfully",
  async fn() {
    // Clean up any previous test image
    await run(["docker", "rmi", "-f", IMAGE_NAME]);

    const result = await run([
      "docker",
      "build",
      "-t",
      IMAGE_NAME,
      ".",
    ]);

    assertEquals(
      result.success,
      true,
      `Docker build failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "docker: container starts and health check returns ok",
  async fn() {
    // Clean up any previous test container
    await run(["docker", "rm", "-f", CONTAINER_NAME]);

    // Start container
    const startResult = await run([
      "docker",
      "run",
      "-d",
      "--name",
      CONTAINER_NAME,
      "-p",
      `${PORT}:8000`,
      "-e",
      "DASHBOARD_PASSWORD=test-password",
      IMAGE_NAME,
    ]);

    assertEquals(
      startResult.success,
      true,
      `Failed to start container:\n${startResult.stderr}`,
    );

    // Wait for health endpoint
    const ready = await waitForUrl(HEALTH_URL);
    assertEquals(ready, true, "Health endpoint did not respond in time");

    // Check health response
    const res = await fetch(HEALTH_URL);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.status, "ok");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "docker: container serves /seb-monitor.js static file",
  async fn() {
    const res = await fetch(CLIENT_JS_URL);
    assertEquals(res.status, 200);
    const contentType = res.headers.get("content-type");
    assertStringIncludes(contentType ?? "", "javascript");
    const body = await res.text();
    assertStringIncludes(body, "studentId");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "docker: container serves /exam.html demo page",
  async fn() {
    const res = await fetch(`http://localhost:${PORT}/exam.html`);
    assertEquals(res.status, 200);
    const body = await res.text();
    assertStringIncludes(body, "seb-monitor");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "docker: container accepts heartbeat POST",
  async fn() {
    const payload = {
      studentId: "test-student",
      examId: "test-exam",
      questionId: "default",
      timestamp: Date.now(),
      sessionId: "",
      focus: { focusedTimeMs: 1000, unfocusedTimeMs: 0, blurCount: 0 },
      input: {
        typedChars: 10,
        pastedChars: 0,
        deletedChars: 0,
        currentLength: 10,
      },
      keys: { keyDownCount: 10, ctrlCount: 0, altCount: 0, shiftCount: 0 },
      copyCount: 0,
      pasteCount: 0,
      events: [],
    };

    const res = await fetch(`http://localhost:${PORT}/api/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(typeof body.sessionId, "string");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "docker: cleanup — stop and remove test container",
  async fn() {
    await run(["docker", "rm", "-f", CONTAINER_NAME]);
    await run(["docker", "rmi", "-f", IMAGE_NAME]);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
