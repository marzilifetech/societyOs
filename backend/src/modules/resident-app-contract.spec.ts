/**
 * Requests the resident app already on phones sends, run through the same
 * validation as the global pipe (transform + whitelist + forbidNonWhitelisted).
 * Each of these used to be rejected with a 400, so the feature was dead for
 * every user until the app was updated.
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateHousekeepingDto } from './housekeeping/dto/create-housekeeping.dto';
import { CreateComplaintDto } from './complaint/dto/complaint.dto';
import { RateConciergeDto } from './concierge/dto/concierge.dto';
import { CreateFamilyMemberDto } from './family-member/dto/family-member.dto';
import { CreatePostDto } from './community/dto/community.dto';
import { CreateVendorOrderDto } from './vendor/dto/create-order.dto';
import { CreateSubscriptionDto } from './subscription/dto/create-subscription.dto';
import { CreateDocumentRequestDto, RateDocumentRequestDto } from './document-request/dto/document-request.dto';
import { SubmitFeedbackDto } from './feedback/dto/feedback.dto';
import { documentTypeFor } from './document-request/document-request.service';
import { feedbackCategoryFor } from './feedback/feedback.service';

async function check<T extends object>(cls: new () => T, body: object) {
  const dto = plainToInstance(cls, body, { enableImplicitConversion: true });
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, problems: errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`) };
}

describe('resident app requests are accepted', () => {
  it('housekeeping booking with a label', async () => {
    const { dto, problems } = await check(CreateHousekeepingDto, {
      type: 'Deep Clean',
      scheduledAt: '2026-10-12T04:30:00.000Z',
      notes: 'Kitchen first',
    });
    expect(problems).toEqual([]);
    expect(dto.type).toBe('DEEP_CLEAN');
  });

  it('complaint with a photo', async () => {
    const { problems } = await check(CreateComplaintDto, {
      category: 'WATER',
      title: 'Leak',
      description: 'Bathroom ceiling',
      photoUrl: 'media/complaints/abc.jpg',
    });
    expect(problems).toEqual([]);
  });

  it('help-request rating with a comment', async () => {
    const { problems } = await check(RateConciergeDto, { rating: 5, comment: 'Quick, thanks' });
    expect(problems).toEqual([]);
  });

  it('family member without a phone, with DOB, blood group and emergency flag', async () => {
    const { problems } = await check(CreateFamilyMemberDto, {
      name: 'Aarav',
      relationship: 'Son',
      dateOfBirth: '2016-04-02',
      bloodGroup: 'B+',
      isEmergencyContact: false,
    });
    expect(problems).toEqual([]);
  });

  it('community post with a category', async () => {
    const { problems } = await check(CreatePostDto, { content: 'Lost keys near gate 2', category: 'Lost & Found' });
    expect(problems).toEqual([]);
  });

  it('vendor order with price and deliveryDate', async () => {
    const { problems } = await check(CreateVendorOrderDto, {
      items: [{ name: 'Milk', quantity: 2, price: 30 }],
      deliveryDate: '2026-10-12',
    });
    expect(problems).toEqual([]);
  });

  it('subscription as type, provider and quantity', async () => {
    const { problems } = await check(CreateSubscriptionDto, {
      type: 'MILK',
      provider: 'Amul',
      quantity: 2,
      frequency: 'DAILY',
    });
    expect(problems).toEqual([]);
  });

  it('document request with a label and notes, and a rating with a comment', async () => {
    expect((await check(CreateDocumentRequestDto, { type: 'Possession Letter', notes: 'For bank' })).problems).toEqual([]);
    expect((await check(RateDocumentRequestDto, { rating: 4, comment: 'ok' })).problems).toEqual([]);
    expect(documentTypeFor('Possession Letter')).toEqual({ type: 'OTHER', label: 'Possession Letter' });
    expect(documentTypeFor('NOC')).toEqual({ type: 'NOC', label: null });
    expect(documentTypeFor('Maintenance Receipt')).toEqual({ type: 'PAYMENT_CERT', label: null });
  });

  it('feedback with a subject and an app category', async () => {
    const { problems } = await check(SubmitFeedbackDto, {
      category: 'Maintenance',
      subject: 'Lift',
      message: 'The lift in B block stops between floors.',
      rating: 3,
    });
    expect(problems).toEqual([]);
    expect(feedbackCategoryFor('Maintenance')).toEqual({ category: 'OTHER', topic: 'Maintenance' });
    expect(feedbackCategoryFor('Suggestion')).toEqual({ category: 'SUGGESTION', topic: null });
  });

  it('still rejects fields nobody sends', async () => {
    const { problems } = await check(CreateComplaintDto, { category: 'WATER', title: 'x', hacked: true });
    expect(problems.join()).toMatch(/hacked/);
  });
});
