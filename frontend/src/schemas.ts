/**
 * NutriOS — Zod Validation Schemas
 * Centralised schemas for all user-facing forms.
 */
import { z } from 'zod';

/* ────────────── Weight ────────────── */
export const weightSchema = z.object({
  weight_kg: z
    .string()
    .min(1, 'Weight is required')
    .refine((v) => !isNaN(parseFloat(v)), 'Must be a number')
    .refine((v) => parseFloat(v) >= 20, 'Minimum weight is 20 kg')
    .refine((v) => parseFloat(v) <= 400, 'Maximum weight is 400 kg'),
  note: z.string().max(200, 'Note must be under 200 characters').optional(),
});

/* ────────────── Routine ────────────── */
export const routineSchema = z.object({
  name: z
    .string()
    .min(1, 'Routine name is required')
    .max(100, 'Name must be under 100 characters'),
  type: z.string().min(1, 'Select a routine type'),
  time_start: z.string().min(1, 'Start time is required'),
  time_end: z.string().min(1, 'End time is required'),
  tasks: z.string().max(500, 'Tasks too long').optional(),
});

/* ────────────── Recipe ────────────── */
export const recipeSchema = z.object({
  name: z
    .string()
    .min(1, 'Recipe name is required')
    .max(150, 'Name must be under 150 characters'),
  description: z.string().max(500, 'Description too long').optional(),
  servings: z
    .string()
    .refine((v) => !isNaN(parseInt(v, 10)), 'Must be a number')
    .refine((v) => parseInt(v, 10) >= 1, 'At least 1 serving')
    .refine((v) => parseInt(v, 10) <= 50, 'Maximum 50 servings'),
  prep_time_mins: z
    .string()
    .refine((v) => v === '' || !isNaN(parseInt(v, 10)), 'Must be a number')
    .optional(),
  cook_time_mins: z
    .string()
    .refine((v) => v === '' || !isNaN(parseInt(v, 10)), 'Must be a number')
    .optional(),
});

/* ────────────── Meal Plan ────────────── */
export const mealPlanSchema = z.object({
  notes: z.string().max(300, 'Notes must be under 300 characters').optional(),
});

/* ────────────── Profile (Settings) ────────────── */
export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  weight_kg: z
    .string()
    .refine((v) => v === '' || !isNaN(parseFloat(v)), 'Must be a number')
    .refine((v) => v === '' || parseFloat(v) >= 20, 'Minimum 20 kg')
    .refine((v) => v === '' || parseFloat(v) <= 400, 'Maximum 400 kg'),
  height_cm: z
    .string()
    .refine((v) => v === '' || !isNaN(parseFloat(v)), 'Must be a number')
    .refine((v) => v === '' || parseFloat(v) >= 50, 'Minimum 50 cm')
    .refine((v) => v === '' || parseFloat(v) <= 300, 'Maximum 300 cm'),
  age: z
    .string()
    .refine((v) => v === '' || !isNaN(parseInt(v, 10)), 'Must be a number')
    .refine((v) => v === '' || parseInt(v, 10) >= 1, 'Minimum age 1')
    .refine((v) => v === '' || parseInt(v, 10) <= 150, 'Maximum age 150'),
});

/* ────────────── Quick Meal (Dashboard) ────────────── */
export const quickMealSchema = z.object({
  food_name: z
    .string()
    .min(1, 'Food name is required')
    .max(200, 'Name must be under 200 characters'),
  portion_grams: z
    .string()
    .min(1, 'Portion is required')
    .refine((v) => !isNaN(parseFloat(v)), 'Must be a number')
    .refine((v) => parseFloat(v) > 0, 'Must be greater than 0')
    .refine((v) => parseFloat(v) <= 10000, 'Maximum 10,000g'),
});

/* ────────────── AI Chat ────────────── */
export const chatSchema = z.object({
  message: z
    .string()
    .min(1, 'Type a message')
    .max(500, 'Message must be under 500 characters'),
});
