import { LeaveRequestRepository } from "../repositories/LeaveRequestRepository";
import {
  CreateLeaveRequest,
  LeaveRequestEntity,
  LeaveRequestRecord,
  LeaveRequestSnapshot,
  LeaveStatus,
  LeaveType,
  ReviewLeaveRequest,
} from "../models/LeaveRequest";

const VALID_LEAVE_TYPES: readonly LeaveType[] = [
  "annual",
  "sick",
  "personal",
  "unpaid",
  "maternity",
  "paternity",
];

const VALID_STATUS_FILTERS: readonly LeaveStatus[] = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
];

abstract class AbstractLeaveRequestService {
  protected constructor(protected readonly leaveRequestRepository: LeaveRequestRepository) {}

  protected toSnapshots(records: LeaveRequestRecord[], actorUserId: number): LeaveRequestSnapshot[] {
    return records.map((record) => LeaveRequestEntity.fromRecord(record).toSnapshot(actorUserId));
  }

  protected sanitizeText(value: unknown, maxLength: number): string {
    if (typeof value !== "string") {
      return "";
    }

    return value
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);
  }

  protected parsePositiveId(value: unknown): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}

export class LeaveRequestService extends AbstractLeaveRequestService {
  constructor(leaveRequestRepository = new LeaveRequestRepository()) {
    super(leaveRequestRepository);
  }

  public async submit(userId: number, data: CreateLeaveRequest): Promise<LeaveRequestSnapshot> {
    const cleanData = {
      ...data,
      reason: this.sanitizeText(data.reason, 500),
    };

    const totalDays = this.calculateInclusiveDays(cleanData.startDate, cleanData.endDate);
    const record = await this.leaveRequestRepository.create(userId, cleanData, totalDays);
    return LeaveRequestEntity.fromRecord(record).toSnapshot(userId);
  }

  public async getStaffRequests(userId: number): Promise<LeaveRequestSnapshot[]> {
    const records = await this.leaveRequestRepository.findForUser(userId);
    return this.toSnapshots(records, userId);
  }

  public async cancel(userId: number, idValue: unknown): Promise<LeaveRequestSnapshot | null> {
    const id = this.parsePositiveId(idValue);
    if (!id) {
      return null;
    }

    const request = await this.leaveRequestRepository.findById(id);
    if (!request || !LeaveRequestEntity.fromRecord(request).canCancel(userId)) {
      return null;
    }

    const cancelled = await this.leaveRequestRepository.cancelPending(id, userId);
    return cancelled ? this.getByIdForActor(id, userId) : null;
  }

  public async getAdminRequests(status?: LeaveStatus): Promise<LeaveRequestSnapshot[]> {
    const records = await this.leaveRequestRepository.findAll(status);
    return this.toSnapshots(records, 0);
  }

  public async approve(
    reviewerId: number,
    idValue: unknown,
    data: ReviewLeaveRequest,
  ): Promise<LeaveRequestSnapshot | null> {
    return this.review(reviewerId, idValue, "approved", data);
  }

  public async reject(
    reviewerId: number,
    idValue: unknown,
    data: ReviewLeaveRequest,
  ): Promise<LeaveRequestSnapshot | null> {
    return this.review(reviewerId, idValue, "rejected", data);
  }

  public validateCreateRequest(data: Partial<CreateLeaveRequest>): string | null {
    if (!data.leaveType || !VALID_LEAVE_TYPES.includes(data.leaveType)) {
      return "A valid leave type is required";
    }

    if (!data.startDate || !this.isDate(data.startDate)) {
      return "A valid start date is required";
    }

    if (!data.endDate || !this.isDate(data.endDate)) {
      return "A valid end date is required";
    }

    if (this.isBeforeToday(data.startDate) || this.isBeforeToday(data.endDate)) {
      return "Leave dates cannot be in the past";
    }

    if (this.calculateInclusiveDays(data.startDate, data.endDate) < 1) {
      return "End date must be the same as or after start date";
    }

    const reason = this.sanitizeText(data.reason, 500);
    if (reason.length < 3) {
      return "A reason with at least 3 characters is required";
    }

    return null;
  }

  public validateReviewRequest(data: Partial<ReviewLeaveRequest>, requireNote = false): string | null {
    if (data.note !== undefined && typeof data.note !== "string") {
      return "Reviewer note must be text";
    }

    const note = this.sanitizeText(data.note, 500);
    if (requireNote && note.length < 3) {
      return "A rejection reason with at least 3 characters is required";
    }

    if (typeof data.note === "string" && data.note.trim().length > 500) {
      return "Reviewer note must be 500 characters or fewer";
    }

    return null;
  }

  public parseStatus(value: unknown): LeaveStatus | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    return VALID_STATUS_FILTERS.includes(value as LeaveStatus) ? (value as LeaveStatus) : undefined;
  }

  private async review(
    reviewerId: number,
    idValue: unknown,
    status: Extract<LeaveStatus, "approved" | "rejected">,
    data: ReviewLeaveRequest,
  ): Promise<LeaveRequestSnapshot | null> {
    const id = this.parsePositiveId(idValue);
    if (!id) {
      return null;
    }

    const request = await this.leaveRequestRepository.findById(id);
    if (!request || !LeaveRequestEntity.fromRecord(request).canReview()) {
      return null;
    }

    const reviewerNote = this.sanitizeText(data.note, 500) || null;
    const reviewed = await this.leaveRequestRepository.reviewPending(id, reviewerId, status, reviewerNote);
    return reviewed ? this.getByIdForActor(id, reviewerId) : null;
  }

  private async getByIdForActor(id: number, actorUserId: number): Promise<LeaveRequestSnapshot | null> {
    const record = await this.leaveRequestRepository.findById(id);
    return record ? LeaveRequestEntity.fromRecord(record).toSnapshot(actorUserId) : null;
  }

  private calculateInclusiveDays(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 0;
    }

    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // 0 = Sunday, 6 = Saturday
        count++;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return count;
  }

  private isBeforeToday(value: string): boolean {
    return Date.parse(`${value}T00:00:00Z`) < Date.parse(`${this.today()}T00:00:00Z`);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private isDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  }
}
