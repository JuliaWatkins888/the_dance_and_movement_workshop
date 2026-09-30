import mongoose, { Schema, Document, Types } from 'mongoose';
import { EVENT_BULK_DISCOUNT_KINDS, EVENT_IMAGE_SOURCE_TYPES } from '../contracts/event.contract';
import type { EventBannerConfig, EventBulkDiscount, EventImageSourceType } from '../contracts/event.contract';

export interface EventTicketTypeDocument {
  _id: Types.ObjectId;
  name: string;
  priceCents: number;
}

export interface EventDocument extends Document {
  title: string;
  slug: string;
  description?: string;
  attendeeNotes?: string;
  date: Date;
  startTime: string;
  endTime?: string;
  doorsOpenTime?: string;
  startsAt: Date;
  endsAt: Date;
  salesCloseDate?: Date;
  salesCloseTime?: string;
  salesClosesAt?: Date;
  isAtStudio: boolean;
  venueName?: string;
  venueAddress?: string;
  ticketTypes: EventTicketTypeDocument[];
  bulkDiscount?: EventBulkDiscount;
  imageUrl?: string;
  imageSourceType?: EventImageSourceType;
  imageAssetId?: string;
  banner?: EventBannerConfig;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const eventTicketTypeSchema = new Schema<EventTicketTypeDocument>({
  name: { type: String, required: true },
  priceCents: { type: Number, required: true },
});

const eventBulkDiscountSchema = new Schema<EventBulkDiscount>(
  {
    minTickets: { type: Number, required: true },
    kind: { type: String, enum: EVENT_BULK_DISCOUNT_KINDS, required: true },
    value: { type: Number, required: true },
  },
  { _id: false },
);

const eventBannerSchema = new Schema<EventBannerConfig>(
  {
    cellSize: { type: Number, required: true },
    variance: { type: Number, required: true },
    xColors: { type: [String], required: true },
    yColors: { type: [String], required: true },
  },
  { _id: false },
);

const eventSchema = new Schema<EventDocument>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: false },
    attendeeNotes: { type: String, required: false },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: false },
    doorsOpenTime: { type: String, required: false },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    salesCloseDate: { type: Date, required: false },
    salesCloseTime: { type: String, required: false },
    salesClosesAt: { type: Date, required: false },
    isAtStudio: { type: Boolean, required: true, default: true },
    venueName: { type: String, required: false },
    venueAddress: { type: String, required: false },
    ticketTypes: { type: [eventTicketTypeSchema], required: true, default: [] },
    bulkDiscount: { type: eventBulkDiscountSchema, required: false },
    imageUrl: { type: String, required: false },
    imageSourceType: { type: String, enum: EVENT_IMAGE_SOURCE_TYPES, required: false },
    imageAssetId: { type: String, required: false },
    banner: { type: eventBannerSchema, required: false },
    isPublished: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const EventModel = mongoose.models['Event'] || mongoose.model<EventDocument>('Event', eventSchema);
