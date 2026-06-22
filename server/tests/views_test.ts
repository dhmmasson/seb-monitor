/**
 * Tests for SSR view rendering — layout, login, exam-list.
 * RED phase: these tests should fail until implementation exists.
 */
import { assertEquals, assertExists } from "@std/assert";
import { renderLayout } from "../src/views/layout.ts";
import { renderLoginPage } from "../src/views/login.ts";
import { renderExamList } from "../src/views/exam-list.ts";
import { encodeExamId } from "../src/routes/url-ids.ts";
import type { ExamSummaryEntry } from "../src/services/metrics.ts";

// ===== Layout =====

Deno.test("renderLayout: wraps content in HTML structure with title", () => {
  const html = renderLayout("Test Page", "<p>Hello</p>");
  assertExists(html, "should return HTML string");
  assertEquals(
    html.includes("<!DOCTYPE html>"),
    true,
    "should include doctype",
  );
  assertEquals(
    html.includes("<title>Test Page</title>"),
    true,
    "should include title",
  );
  assertEquals(html.includes("<p>Hello</p>"), true, "should include content");
  assertEquals(html.includes("</html>"), true, "should close html tag");
});

Deno.test("renderLayout: includes meta charset and viewport", () => {
  const html = renderLayout("Test", "<p>X</p>");
  assertEquals(
    html.includes('charset="UTF-8"'),
    true,
    "should include charset",
  );
  assertEquals(
    html.includes('name="viewport"'),
    true,
    "should include viewport meta",
  );
});

Deno.test("renderLayout: includes minimal embedded CSS", () => {
  const html = renderLayout("Test", "<p>X</p>");
  assertEquals(html.includes("<style>"), true, "should include style tag");
});

// ===== Login Page =====

Deno.test("renderLoginPage: returns a full page with login form", () => {
  const html = renderLoginPage();
  assertEquals(html.includes("<!DOCTYPE html>"), true, "should be full page");
  assertEquals(html.includes('method="POST"'), true, "form should use POST");
  assertEquals(
    html.includes('type="password"'),
    true,
    "should have password field",
  );
  assertEquals(
    html.includes('type="submit"'),
    true,
    "should have submit button",
  );
});

Deno.test("renderLoginPage: shows error message when provided", () => {
  const html = renderLoginPage("Invalid password");
  assertEquals(
    html.includes("Invalid password"),
    true,
    "should display error message",
  );
});

Deno.test("renderLoginPage: no error when not provided", () => {
  const html = renderLoginPage();
  // Check that no error message div with content appears (class is in CSS, so check for the element)
  assertEquals(
    html.includes('class="error-message"'),
    false,
    "should not show error div element",
  );
});

// ===== Exam List =====

Deno.test("renderExamList: renders student rows in a table", () => {
  const students: ExamSummaryEntry[] = [
    {
      sessionId: "s1",
      studentId: "Alice",
      focusRatio: 0.95,
      pasteRatio: 0.1,
      totalCopyCount: 2,
      totalPasteCount: 1,
      unmatchedPasteCount: 0,
      largestPasteLength: 50,
      largestPasteHash: "aaa",
    },
    {
      sessionId: "s2",
      studentId: "Bob",
      focusRatio: 0.5,
      pasteRatio: 0.8,
      totalCopyCount: 0,
      totalPasteCount: 5,
      unmatchedPasteCount: 3,
      largestPasteLength: 500,
      largestPasteHash: "bbb",
    },
  ];
  const html = renderExamList("exam-1", students);
  assertExists(html, "should return HTML");
  assertEquals(html.includes("Alice"), true, "should include Alice");
  assertEquals(html.includes("Bob"), true, "should include Bob");
  assertEquals(html.includes("<table"), true, "should include a table");
});

Deno.test("renderExamList: shows focus ratio as percentage", () => {
  const students: ExamSummaryEntry[] = [
    {
      sessionId: "s1",
      studentId: "Alice",
      focusRatio: 0.95,
      pasteRatio: 0.1,
      totalCopyCount: 0,
      totalPasteCount: 0,
      unmatchedPasteCount: 0,
      largestPasteLength: 0,
      largestPasteHash: "",
    },
  ];
  const html = renderExamList("exam-1", students);
  assertEquals(html.includes("95"), true, "should show 95% focus ratio");
});

Deno.test("renderExamList: links to student detail page", () => {
  const students: ExamSummaryEntry[] = [
    {
      sessionId: "s1",
      studentId: "Alice",
      focusRatio: 0.9,
      pasteRatio: 0.0,
      totalCopyCount: 0,
      totalPasteCount: 0,
      unmatchedPasteCount: 0,
      largestPasteLength: 0,
      largestPasteHash: "",
    },
  ];
  const html = renderExamList("exam-uuid-123", students);
  const encodedId = encodeExamId("exam-uuid-123");
  assertEquals(
    html.includes(`/dashboard/${encodedId}/student/s1`),
    true,
    `should link to /dashboard/${encodedId}/student/s1`,
  );
});

Deno.test("renderExamList: handles empty student list", () => {
  const html = renderExamList("exam-1", []);
  assertEquals(
    html.includes("No students"),
    true,
    "should show empty state message",
  );
});

// ===== XSS Escaping Tests =====

Deno.test("renderExamList: escapes HTML in student names to prevent XSS", () => {
  const students: ExamSummaryEntry[] = [
    {
      sessionId: "s1",
      studentId: '<script>alert("xss")</script>',
      focusRatio: 0.9,
      pasteRatio: 0.0,
      totalCopyCount: 0,
      totalPasteCount: 0,
      unmatchedPasteCount: 0,
      largestPasteLength: 0,
      largestPasteHash: "",
    },
  ];
  const html = renderExamList("exam-1", students);
  assertEquals(
    html.includes('data-sort="<script>'),
    false,
    "raw <script> tag must not appear in data-sort attribute",
  );
  assertEquals(
    html.includes("&lt;script&gt;"),
    true,
    "HTML entities should be escaped",
  );
});

Deno.test("renderExamList: escapes HTML in exam ID heading", () => {
  const students: ExamSummaryEntry[] = [
    {
      sessionId: "s1",
      studentId: "Alice",
      focusRatio: 0.9,
      pasteRatio: 0.0,
      totalCopyCount: 0,
      totalPasteCount: 0,
      unmatchedPasteCount: 0,
      largestPasteLength: 0,
      largestPasteHash: "",
    },
  ];
  const html = renderExamList("<img src=x onerror=alert(1)>", students);
  // The h1 heading uses escapeHtml(examId)
  assertEquals(
    html.includes("📋 Exam: &lt;img"),
    true,
    "h1 heading should escape HTML in exam ID",
  );
});

// ===== Sortable Table Tests =====

Deno.test("renderExamList: sortable headers have data-sort-key attributes", () => {
  const students: ExamSummaryEntry[] = [
    {
      sessionId: "s1",
      studentId: "Alice",
      focusRatio: 0.95,
      pasteRatio: 0.1,
      totalCopyCount: 2,
      totalPasteCount: 1,
      unmatchedPasteCount: 0,
      largestPasteLength: 50,
      largestPasteHash: "aaa",
    },
  ];
  const html = renderExamList("exam-1", students);
  assertExists(html, "should return HTML");
  assertEquals(html.includes('data-sort-key="name"'), true, "should have name sort key");
  assertEquals(html.includes('data-sort-key="focus"'), true, "should have focus sort key");
  assertEquals(html.includes('data-sort-key="paste"'), true, "should have paste sort key");
  assertEquals(html.includes('data-sort-key="copies"'), true, "should have copies sort key");
  assertEquals(html.includes('data-sort-key="pastes"'), true, "should have pastes sort key");
  assertEquals(html.includes('data-sort-key="unmatched"'), true, "should have unmatched sort key");
  assertEquals(html.includes('data-sort-key="largestPaste"'), true, "should have largestPaste sort key");
});

Deno.test("renderExamList: sortable headers have sortable class", () => {
  const students: ExamSummaryEntry[] = [
    {
      sessionId: "s1",
      studentId: "Alice",
      focusRatio: 0.9,
      pasteRatio: 0.0,
      totalCopyCount: 0,
      totalPasteCount: 0,
      unmatchedPasteCount: 0,
      largestPasteLength: 0,
      largestPasteHash: "",
    },
  ];
  const html = renderExamList("exam-1", students);
  assertEquals(html.includes("sortable"), true, "should have sortable class on headers");
});

Deno.test("renderExamList: student rows have data-sort attributes", () => {
  const students: ExamSummaryEntry[] = [
    {
      sessionId: "s1",
      studentId: "Alice",
      focusRatio: 0.95,
      pasteRatio: 0.1,
      totalCopyCount: 2,
      totalPasteCount: 1,
      unmatchedPasteCount: 0,
      largestPasteLength: 50,
      largestPasteHash: "aaa",
    },
  ];
  const html = renderExamList("exam-1", students);
  assertEquals(html.includes('data-sort="Alice"'), true, "should have name data-sort");
  assertEquals(html.includes('data-sort="95"'), true, "should have focus data-sort as percentage");
  assertEquals(html.includes('data-sort="10"'), true, "should have paste data-sort as percentage");
  assertEquals(html.includes('data-sort="2"'), true, "should have copies data-sort");
  assertEquals(html.includes('data-sort="1"'), true, "should have pastes data-sort");
  assertEquals(html.includes('data-sort="0"'), true, "should have unmatched data-sort");
  assertEquals(html.includes('data-sort="50"'), true, "should have largestPaste data-sort");
});

Deno.test("renderExamList: includes inline sort script", () => {
  const students: ExamSummaryEntry[] = [
    {
      sessionId: "s1",
      studentId: "Alice",
      focusRatio: 0.9,
      pasteRatio: 0.0,
      totalCopyCount: 0,
      totalPasteCount: 0,
      unmatchedPasteCount: 0,
      largestPasteLength: 0,
      largestPasteHash: "",
    },
  ];
  const html = renderExamList("exam-1", students);
  assertEquals(html.includes("<script>"), true, "should include inline script");
  assertEquals(html.includes("sortTable"), true, "should include sortTable function");
});
