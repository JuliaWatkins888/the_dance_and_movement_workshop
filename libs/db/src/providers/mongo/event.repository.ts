import { isValidObjectId } from 'mongoose';
import type { Model } from 'mongoose';
import type {
  CreateEventInput,
  EventEntity,
  EventRepository,
  EventTicketTypeEntity,
  EventTicketTypeInput,
  UpdateEventInput,
} from '../../contracts/event.contract';
import { toUpdateOperations } from '../../utils/toUpdateOperations';
import type { EventDocument, EventTicketTypeDocument } from '../../schemas/event.schema';

const mapTicketType = (doc: EventTicketTypeDocument): EventTicketTypeEntity => ({
  id: doc._id.toString(),
  name: doc.name,
  priceCents: doc.priceCents,
});

const mapToEventEntity = (doc: EventDocument): EventEntity => ({
  id: doc._id.toString(),
  title: doc.title,
  slug: doc.slug,
  description: doc.description ?? undefined,
  attendeeNotes: doc.attendeeNotes ?? undefined,
  date: doc.date,
  startTime: doc.startTime,
  endTime: doc.endTime ?? undefined,
  doorsOpenTime: doc.doorsOpenTime ?? undefined,
  startsAt: doc.startsAt,
  endsAt: doc.endsAt,
  salesCloseDate: doc.salesCloseDate ?? undefined,
  salesCloseTime: doc.salesCloseTime ?? undefined,
  salesClosesAt: doc.salesClosesAt ?? undefined,
  isAtStudio: doc.isAtStudio,
  venueName: doc.venueName ?? undefined,
  venueAddress: doc.venueAddress ?? undefined,
  ticketTypes: (doc.ticketTypes ?? []).map(mapTicketType),
  bulkDiscount: doc.bulkDiscount
    ? { minTickets: doc.bulkDiscount.minTickets, kind: doc.bulkDiscount.kind, value: doc.bulkDiscount.value }
    : undefined,
  imageUrl: doc.imageUrl ?? undefined,
  imageSourceType: doc.imageSourceType ?? undefined,
  imageAssetId: doc.imageAssetId ?? undefined,
  banner: doc.banner
    ? { cellSize: doc.banner.cellSize, variance: doc.banner.variance, xColors: [...doc.banner.xColors], yColors: [...doc.banner.yColors] }
    : undefined,
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

// An existing ticket type keeps its _id so cart lines pointing at it stay valid.
const toTicketTypeDocument = ({ id, ...ticketType }: EventTicketTypeInput) => (id ? { _id: id, ...ticketType } : ticketType);

export const createMongoEventRepository = (model: Model<EventDocument>): EventRepository => ({
  findAll: async () => {
    const docs = await model.find().sort({ startsAt: 1 }).exec();
    return docs.map(mapToEventEntity);
  },
  findById: async (id: string) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToEventEntity(doc) : null;
  },
  findBySlug: async (slug: string) => {
    const doc = await model.findOne({ slug }).exec();
    return doc ? mapToEventEntity(doc) : null;
  },
  create: async ({ ticketTypes, ...input }: CreateEventInput) =>
    mapToEventEntity(await model.create({ ...input, ticketTypes: ticketTypes.map(toTicketTypeDocument) })),
  update: async (id: string, { ticketTypes, ...input }: UpdateEventInput) => {
    if (!isValidObjectId(id)) return null;
    const operations = toUpdateOperations({ ...input, ...(ticketTypes ? { ticketTypes: ticketTypes.map(toTicketTypeDocument) } : {}) });
    const doc = await model.findByIdAndUpdate(id, operations, { new: true, runValidators: true }).exec();
    return doc ? mapToEventEntity(doc) : null;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) return false;
    return (await model.findByIdAndDelete(id).exec()) !== null;
  },
});
