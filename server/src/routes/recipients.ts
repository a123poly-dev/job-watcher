import { Router } from 'express';
import prisma from '../db';
import { sendTestEmail } from '../mailer';

const router = Router();

router.get('/', async (_req, res) => {
  const recipients = await prisma.recipient.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(recipients);
});

router.post('/', async (req, res) => {
  const { label, email } = req.body;
  try {
    const recipient = await prisma.recipient.create({ data: { label, email } });
    res.json(recipient);
  } catch (err: any) {
    const isDuplicate = err?.code === 'P2002';
    res.status(400).json({ error: isDuplicate ? 'Email already exists' : (err?.message || String(err)) });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.recipient.delete({ where: { id } });
  res.json({ ok: true });
});

router.post('/test-email', async (req, res) => {
  const { email } = req.body;
  try {
    await sendTestEmail(email);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
