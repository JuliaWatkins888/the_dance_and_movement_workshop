import { isValidObjectId, Types } from 'mongoose';
import type { Model } from 'mongoose';
import type {
  CreateSchoolYearInput,
  SchoolYearEntity,
  SchoolYearRepository,
  SemesterInput,
  UpdateSchoolYearInput,
} from '../../contracts/school-year.contract';
import { toUpdateOperations } from '../../utils/toUpdateOperations';
import type { SchoolYearDocument } from '../../schemas/school-year.schema';

const mapToSchoolYearEntity = (doc: SchoolYearDocument): SchoolYearEntity => ({
  id: doc._id.toString(),
  name: doc.name,
  registrationOpensAt: doc.registrationOpensAt ?? undefined,
  semesters: doc.semesters.map((semester) => ({
    id: semester._id.toString(),
    name: semester.name,
    startDate: semester.startDate,
    endDate: semester.endDate,
  })),
  isPublished: doc.isPublished,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

// Reusing an incoming id as the subdocument _id is what keeps sections pointing at a semester
// linked across an edit of the full semester list.
const toSemesterSubdocuments = (semesters: SemesterInput[]) =>
  [...semesters]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map(({ id, ...semester }) => ({
      ...semester,
      _id: id && isValidObjectId(id) ? new Types.ObjectId(id) : new Types.ObjectId(),
    }));

export const createMongoSchoolYearRepository = (model: Model<SchoolYearDocument>): SchoolYearRepository => ({
  findAll: async () => {
    const docs = await model.find().sort({ 'semesters.0.startDate': 1, name: 1 }).exec();
    return docs.map(mapToSchoolYearEntity);
  },
  findById: async (id: string) => {
    if (!isValidObjectId(id)) return null;
    const doc = await model.findById(id).exec();
    return doc ? mapToSchoolYearEntity(doc) : null;
  },
  create: async (input: CreateSchoolYearInput) =>
    mapToSchoolYearEntity(await model.create({ ...input, semesters: toSemesterSubdocuments(input.semesters) })),
  update: async (id: string, input: UpdateSchoolYearInput) => {
    if (!isValidObjectId(id)) return null;
    const { semesters, ...rest } = input;
    const operations = toUpdateOperations({
      ...rest,
      ...(semesters ? { semesters: toSemesterSubdocuments(semesters) } : {}),
    });
    const doc = await model.findByIdAndUpdate(id, operations, { new: true, runValidators: true }).exec();
    return doc ? mapToSchoolYearEntity(doc) : null;
  },
  delete: async (id: string) => {
    if (!isValidObjectId(id)) return false;
    return (await model.findByIdAndDelete(id).exec()) !== null;
  },
});
