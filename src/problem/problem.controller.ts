import { Controller, Post, Body, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { UserService } from "@/user/user.service";
import { GroupService } from "@/group/group.service";
import { ProblemService, ProblemPermissionType } from "./problem.service";
import { CurrentUser } from "@/common/user.decorator";
import { UserEntity } from "@/user/user.entity";
import { ProblemEntity } from "./problem.entity";

import {
  CreateProblemRequestDto,
  CreateProblemResponseDto,
  CreateProblemResponseError,
  UpdateProblemStatementResponseDto,
  UpdateProblemStatementRequestDto,
  UpdateProblemStatementResponseError,
  GetProblemDetailRequestDto,
  GetProblemDetailResponseDto,
  GetProblemDetailResponseError,
  SetProblemPermissionsRequestDto,
  SetProblemPermissionsResponseDto,
  SetProblemPermissionsResponseError
} from "./dto";

@ApiTags("Problem")
@Controller("problem")
export class ProblemController {
  constructor(
    private readonly problemService: ProblemService,
    private readonly userService: UserService,
    private readonly groupService: GroupService
  ) {}

  @Get("create")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create a problem with given statement and default judge info."
  })
  async create(
    @CurrentUser() currentUser: UserEntity,
    @Query() request: CreateProblemRequestDto
  ): Promise<CreateProblemResponseDto> {
    if (
      !(await this.problemService.userHasPermission(
        currentUser,
        ProblemPermissionType.CREATE
      ))
    )
      return {
        error: CreateProblemResponseError.PERMISSION_DENIED
      };

    const problem = await this.problemService.createProblem(
      currentUser,
      request.type,
      request.statement
    );
    if (!problem)
      return {
        error: CreateProblemResponseError.FAILED
      };

    return {
      id: problem.id
    };
  }

  @Post("updateStatement")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update a problem's statement."
  })
  async updateStatement(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: UpdateProblemStatementRequestDto
  ): Promise<UpdateProblemStatementResponseDto> {
    const problem = await this.problemService.findProblemById(
      request.problemId
    );
    if (!problem)
      return {
        error: UpdateProblemStatementResponseError.NO_SUCH_PROBLEM
      };

    if (
      !(await this.problemService.userHasPermission(
        currentUser,
        ProblemPermissionType.WRITE,
        problem
      ))
    )
      return {
        error: UpdateProblemStatementResponseError.PERMISSION_DENIED
      };

    const success = await this.problemService.updateProblemStatement(
      problem,
      request
    );

    if (!success)
      return {
        error: UpdateProblemStatementResponseError.FAILED
      };

    return {};
  }

  @Get("getProblemDetail")
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Get a problem's meta, title, contents, samples, judge info of given locale.",
    description:
      "Title and contents are fallbacked to another locale if none for given locale."
  })
  async getProblemDetail(
    @CurrentUser() currentUser: UserEntity,
    @Query() request: GetProblemDetailRequestDto
  ): Promise<GetProblemDetailResponseDto> {
    let problem: ProblemEntity;
    if (request.id)
      problem = await this.problemService.findProblemById(parseInt(request.id));
    else if (request.displayId)
      problem = await this.problemService.findProblemByDisplayId(
        parseInt(request.displayId)
      );

    if (!problem)
      return {
        error: GetProblemDetailResponseError.NO_SUCH_PROBLEM
      };

    if (
      !(await this.problemService.userHasPermission(
        currentUser,
        ProblemPermissionType.READ,
        problem
      ))
    )
      return {
        error: GetProblemDetailResponseError.PERMISSION_DENIED
      };

    const [
      titleLocale,
      title
    ] = await this.problemService.getProblemLocalizedTitle(
      problem,
      request.locale
    );
    const [
      contentLocale,
      contentSections
    ] = await this.problemService.getProblemLocalizedContent(
      problem,
      request.locale
    );
    const samples = await this.problemService.getProblemSamples(problem);
    const judgeInfo = await this.problemService.getProblemJudgeInfo(problem);

    return {
      meta: {
        id: problem.id,
        displayId: problem.displayId,
        type: problem.type,
        isPublic: problem.isPublic,
        ownerId: problem.ownerId,
        locales: problem.locales
      },
      title: title,
      titleLocale: titleLocale,
      samples: samples,
      contentSections: contentSections,
      contentLocale: contentLocale,
      judgeInfo: judgeInfo
    };
  }

  @Post("setProblemPermissions")
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Set who and which groups have permission to read / write this problem."
  })
  async setProblemPermissions(
    @CurrentUser() currentUser: UserEntity,
    @Body() request: SetProblemPermissionsRequestDto
  ): Promise<SetProblemPermissionsResponseDto> {
    const problem = await this.problemService.findProblemById(
      request.problemId
    );
    if (!problem)
      return {
        error: SetProblemPermissionsResponseError.NO_SUCH_PROBLEM,
        errorObjectId: request.problemId
      };

    if (
      !(await this.problemService.userHasPermission(
        currentUser,
        ProblemPermissionType.CONTROL,
        problem
      ))
    )
      return {
        error: SetProblemPermissionsResponseError.PERMISSION_DENIED
      };

    const users = [];
    for (const userId of request.userIds) {
      const user = await this.userService.findUserById(userId);
      if (!user)
        return {
          error: SetProblemPermissionsResponseError.NO_SUCH_USER,
          errorObjectId: userId
        };

      users.push(user);
    }

    const groups = [];
    for (const groupId of request.groupIds) {
      const group = await this.groupService.findGroupById(groupId);
      if (!group)
        return {
          error: SetProblemPermissionsResponseError.NO_SUCH_GROUP,
          errorObjectId: groupId
        };

      groups.push(group);
    }

    await this.problemService.setProblemPermissions(
      problem,
      request.permissionType,
      users,
      groups
    );

    return {};
  }
}