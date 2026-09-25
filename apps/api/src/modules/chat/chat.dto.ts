import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type {
  AvatarTone,
  ConversationDetail,
  ConversationKind,
  ConversationMemberView,
  ConversationRole,
  ConversationView,
  EditMessageBody,
  MediaItem,
  MediaPage,
  MediaTab,
  MessageKind,
  MessagePage,
  MessagePreview,
  MessageView,
  NotificationLevel,
  PostPolicy,
  PutConversationMemberBody,
  ReactionView,
  ReadCursorBody,
  SendMessageBody,
  SentMessage,
  UpdateConversationBody,
  UpdateMyConversationBody,
} from '@taskin/contracts';
import { AVATAR_TONES } from '../users/me.controller.js';
import { AttachmentViewDto } from '../work/work.dto.js';

export const CONVERSATION_KINDS: readonly ConversationKind[] = ['direct', 'group', 'channel'];
export const CONVERSATION_ROLES: readonly ConversationRole[] = ['owner', 'admin', 'member'];
export const POST_POLICIES: readonly PostPolicy[] = ['everyone', 'admins'];
export const NOTIFICATION_LEVELS: readonly NotificationLevel[] = ['all', 'mentions', 'none'];
export const MESSAGE_KINDS: readonly MessageKind[] = ['text', 'voice', 'file', 'system'];
export const MEDIA_TABS: readonly MediaTab[] = ['files', 'media', 'audio', 'links'];

const trueish = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';

/* ------------------------------------------------------------------ requests */

/**
 * `CreateConversationBody` is a union by `kind`; the DTO validates each variant's fields
 * (a class cannot `implements` a union, so the controller narrows it).
 */
export class CreateConversationDto {
  @ApiProperty({ enum: CONVERSATION_KINDS }) @IsIn(CONVERSATION_KINDS) readonly kind!: ConversationKind;
  @ApiPropertyOptional({ format: 'uuid', description: 'Direct chats: the other person' })
  @ValidateIf((body: CreateConversationDto) => body.kind === 'direct')
  @IsUUID()
  readonly userId?: string;
  @ApiPropertyOptional({ minLength: 1, maxLength: 80, description: 'Groups and channels' })
  @ValidateIf((body: CreateConversationDto) => body.kind !== 'direct')
  @IsString()
  @Length(1, 80)
  readonly title?: string;
  @ApiPropertyOptional({ maxLength: 250 }) @IsOptional() @IsString() @MaxLength(250) readonly topic?: string;
  @ApiPropertyOptional({ enum: AVATAR_TONES }) @IsOptional() @IsIn(AVATAR_TONES) readonly tone?: AvatarTone;
  @ApiPropertyOptional({ description: 'Channels only; default true' }) @IsOptional() @IsBoolean() readonly isPrivate?: boolean;
  @ApiPropertyOptional({ enum: POST_POLICIES, description: 'Channels only' }) @IsOptional() @IsIn(POST_POLICIES) readonly postPolicy?: PostPolicy;
  @ApiPropertyOptional({ type: String, format: 'uuid', isArray: true, maxItems: 200 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  readonly memberIds?: string[];
}

export class UpdateConversationDto implements UpdateConversationBody {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 }) @IsOptional() @IsString() @Length(1, 80) readonly title?: string;
  @ApiPropertyOptional({ maxLength: 250 }) @IsOptional() @IsString() @MaxLength(250) readonly topic?: string;
  @ApiPropertyOptional({ enum: AVATAR_TONES }) @IsOptional() @IsIn(AVATAR_TONES) readonly tone?: AvatarTone;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() readonly isPrivate?: boolean;
  @ApiPropertyOptional({ enum: POST_POLICIES }) @IsOptional() @IsIn(POST_POLICIES) readonly postPolicy?: PostPolicy;
}

export class PutConversationMemberDto implements PutConversationMemberBody {
  @ApiPropertyOptional({ enum: CONVERSATION_ROLES }) @IsOptional() @IsIn(CONVERSATION_ROLES) readonly role?: ConversationRole;
}

export class UpdateMyConversationDto implements UpdateMyConversationBody {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() readonly pinned?: boolean;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time', description: 'An instant; null unmutes' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  readonly mutedUntil?: string | null;
  @ApiPropertyOptional({ enum: NOTIFICATION_LEVELS }) @IsOptional() @IsIn(NOTIFICATION_LEVELS) readonly notificationLevel?: NotificationLevel;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() readonly hidden?: boolean;
}

export class SendMessageDto implements SendMessageBody {
  @ApiProperty({ format: 'uuid', description: 'Chosen by the client; a retry with the same id returns the first message' })
  @IsUUID()
  readonly clientMsgId!: string;
  @ApiProperty({ enum: ['text', 'voice', 'file'] }) @IsIn(['text', 'voice', 'file']) readonly kind!: 'text' | 'voice' | 'file';
  @ApiPropertyOptional({ maxLength: 8000 }) @IsOptional() @IsString() @MaxLength(8000) readonly text?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() readonly attachmentId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() readonly replyToId?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 3600 }) @IsOptional() @IsInt() @Min(1) @Max(3600) readonly durationSec?: number;
  @ApiPropertyOptional({ type: Number, isArray: true, maxItems: 64 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(100, { each: true })
  readonly waveform?: number[];
}

export class EditMessageDto implements EditMessageBody {
  @ApiProperty({ minLength: 1, maxLength: 8000 }) @IsString() @Length(1, 8000) readonly text!: string;
}

export class ReadCursorDto implements ReadCursorBody {
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) readonly seq!: number;
}

export class ConversationListQueryDto {
  @ApiPropertyOptional({ enum: ['mine', 'public'], default: 'mine' }) @IsOptional() @IsIn(['mine', 'public']) readonly scope?: 'mine' | 'public';
  @ApiPropertyOptional({ type: Boolean, description: 'Include hidden direct chats' }) @IsOptional() @Transform(trueish) @IsBoolean() readonly includeHidden?: boolean;
}

export class MessagePageQueryDto {
  @ApiPropertyOptional({ minimum: 1, description: 'Older messages: those before this seq' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) readonly beforeSeq?: number;
  @ApiPropertyOptional({ minimum: 0, description: 'Newer messages: those after this seq' }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) readonly afterSeq?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) readonly limit?: number;
}

export class MediaQueryDto {
  @ApiProperty({ enum: MEDIA_TABS }) @IsIn(MEDIA_TABS) readonly tab!: MediaTab;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) readonly cursor?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 30 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) readonly limit?: number;
}

/* ------------------------------------------------------------------ responses */

export class MessagePreviewDto implements MessagePreview {
  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  @ApiProperty() readonly seq!: number;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) readonly authorId!: string | null;
  @ApiProperty({ enum: MESSAGE_KINDS }) readonly kind!: MessageKind;
  @ApiProperty({ type: String, nullable: true }) readonly text!: string | null;
  @ApiProperty() readonly deleted!: boolean;
  @ApiProperty({ format: 'date-time' }) readonly createdAt!: string;
}

export class ConversationViewDto implements ConversationView {
  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  @ApiProperty({ enum: CONVERSATION_KINDS }) readonly kind!: ConversationKind;
  @ApiProperty({ type: String, nullable: true }) readonly title!: string | null;
  @ApiProperty() readonly topic!: string;
  @ApiProperty({ enum: AVATAR_TONES }) readonly tone!: AvatarTone;
  @ApiProperty() readonly isPrivate!: boolean;
  @ApiProperty({ enum: POST_POLICIES }) readonly postPolicy!: PostPolicy;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) readonly projectId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', isArray: true }) readonly memberIds!: string[];
  @ApiProperty() readonly memberCount!: number;
  @ApiProperty({ enum: CONVERSATION_ROLES, nullable: true }) readonly myRole!: ConversationRole | null;
  @ApiProperty() readonly pinned!: boolean;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) readonly mutedUntil!: string | null;
  @ApiProperty({ enum: NOTIFICATION_LEVELS }) readonly notificationLevel!: NotificationLevel;
  @ApiProperty() readonly hidden!: boolean;
  @ApiProperty({ description: 'Capped at 100' }) readonly unreadCount!: number;
  @ApiProperty() readonly lastSeq!: number;
  @ApiProperty() readonly lastReadSeq!: number;
  @ApiProperty({ type: MessagePreviewDto, nullable: true }) readonly lastMessage!: MessagePreviewDto | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) readonly lastMessageAt!: string | null;
  @ApiProperty() readonly archived!: boolean;
  @ApiProperty({ format: 'date-time' }) readonly createdAt!: string;
}

export class ConversationMemberViewDto implements ConversationMemberView {
  @ApiProperty({ format: 'uuid' }) readonly userId!: string;
  @ApiProperty({ enum: CONVERSATION_ROLES }) readonly role!: ConversationRole;
  @ApiProperty() readonly lastReadSeq!: number;
  @ApiProperty() readonly lastDeliveredSeq!: number;
  @ApiProperty({ format: 'date-time' }) readonly joinedAt!: string;
}

export class ConversationDetailDto extends ConversationViewDto implements ConversationDetail {
  @ApiProperty({ type: ConversationMemberViewDto, isArray: true }) readonly members!: ConversationMemberViewDto[];
}

export class ReactionViewDto implements ReactionView {
  @ApiProperty() readonly emoji!: string;
  @ApiProperty({ type: String, format: 'uuid', isArray: true }) readonly userIds!: string[];
}

export class MessageViewDto implements MessageView {
  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  @ApiProperty({ format: 'uuid' }) readonly conversationId!: string;
  @ApiProperty() readonly seq!: number;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) readonly authorId!: string | null;
  @ApiProperty({ enum: MESSAGE_KINDS }) readonly kind!: MessageKind;
  @ApiProperty({ type: String, nullable: true, description: 'Mentions are <@userId> tokens' }) readonly text!: string | null;
  @ApiProperty({ type: Object, nullable: true, description: 'Voice: {durationSec, waveform}; system: {type, params}' })
  readonly meta!: MessageView['meta'];
  @ApiProperty({ type: AttachmentViewDto, nullable: true }) readonly attachment!: AttachmentViewDto | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) readonly replyToId!: string | null;
  @ApiProperty({ type: String, format: 'uuid', isArray: true }) readonly mentionIds!: string[];
  @ApiProperty({ type: ReactionViewDto, isArray: true }) readonly reactions!: ReactionViewDto[];
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) readonly clientMsgId!: string | null;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' }) readonly editedAt!: string | null;
  @ApiProperty() readonly deleted!: boolean;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) readonly linkedTaskId!: string | null;
  @ApiProperty({ format: 'date-time' }) readonly createdAt!: string;
}

export class MessagePageDto implements MessagePage {
  @ApiProperty({ type: MessageViewDto, isArray: true }) readonly items!: MessageViewDto[];
  @ApiProperty({ type: Number, nullable: true }) readonly olderBeforeSeq!: number | null;
  @ApiProperty({ type: Number, nullable: true }) readonly newerAfterSeq!: number | null;
}

export class SentMessageDto implements SentMessage {
  @ApiProperty({ format: 'uuid' }) readonly id!: string;
  @ApiProperty() readonly seq!: number;
  @ApiProperty({ format: 'date-time' }) readonly createdAt!: string;
  @ApiProperty() readonly duplicate!: boolean;
}

export class MediaItemDto implements MediaItem {
  @ApiProperty({ format: 'uuid' }) readonly messageId!: string;
  @ApiProperty() readonly seq!: number;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) readonly authorId!: string | null;
  @ApiProperty({ format: 'date-time' }) readonly createdAt!: string;
  @ApiProperty({ type: AttachmentViewDto, nullable: true }) readonly attachment!: AttachmentViewDto | null;
  @ApiProperty({ type: Number, nullable: true }) readonly durationSec!: number | null;
  @ApiProperty({ type: String, nullable: true }) readonly url!: string | null;
}

export class MediaPageDto implements MediaPage {
  @ApiProperty({ type: MediaItemDto, isArray: true }) readonly items!: MediaItemDto[];
  @ApiProperty({ type: String, nullable: true }) readonly nextCursor!: string | null;
}
