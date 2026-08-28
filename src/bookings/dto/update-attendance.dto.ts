import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateAttendanceDto {
    @IsIn(['ATTENDED', 'NO_SHOW'])
    @IsNotEmpty()
    status: 'ATTENDED' | 'NO_SHOW';
}