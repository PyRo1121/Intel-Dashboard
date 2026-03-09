import test from "node:test";
import assert from "node:assert/strict";
import { getTelegramCollageCellClass, getTelegramCollageLayoutClass } from "./telegram-media-layout.ts";

test("telegram collage layout helper maps counts to layout classes", () => {
  assert.equal(getTelegramCollageLayoutClass(0), "telegram-photo-collage--single");
  assert.equal(getTelegramCollageLayoutClass(1), "telegram-photo-collage--single");
  assert.equal(getTelegramCollageLayoutClass(2), "telegram-photo-collage--double");
  assert.equal(getTelegramCollageLayoutClass(3), "telegram-photo-collage--triple");
  assert.equal(getTelegramCollageLayoutClass(4), "telegram-photo-collage--quad");
});

test("telegram collage cell helper maps three-photo layouts to hero and side slots", () => {
  assert.equal(getTelegramCollageCellClass(3, 0), "telegram-photo-cell telegram-photo-cell--hero");
  assert.equal(getTelegramCollageCellClass(3, 1), "telegram-photo-cell telegram-photo-cell--side-top");
  assert.equal(getTelegramCollageCellClass(3, 2), "telegram-photo-cell telegram-photo-cell--side-bottom");
  assert.equal(getTelegramCollageCellClass(2, 0), "telegram-photo-cell");
});
