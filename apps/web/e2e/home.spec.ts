import { expect, test } from '@playwright/test';
test('home page responds',async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:/plataforma inmobiliaria/i})).toBeVisible();});
