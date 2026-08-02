package com.vibehr.commoncode;

import com.vibehr.auth.CurrentUser;
import com.vibehr.commoncode.CommonCodeService.ActiveCodes;
import com.vibehr.commoncode.CommonCodeService.CodeGroupItem;
import com.vibehr.commoncode.CommonCodeService.CodeGroupRequest;
import com.vibehr.commoncode.CommonCodeService.CodeGroupUpdateRequest;
import com.vibehr.commoncode.CommonCodeService.CodeItem;
import com.vibehr.commoncode.CommonCodeService.CodeRequest;
import com.vibehr.commoncode.CommonCodeService.CodeUpdateRequest;
import com.vibehr.commoncode.CommonCodeService.PageResult;
import com.vibehr.menu.MenuPermissionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/codes")
@Validated
@Profile("!test")
public class CommonCodeController {

    private static final String MENU_PATH = "/settings/common-codes";
    private final CommonCodeService service;
    private final MenuPermissionService permissions;

    CommonCodeController(CommonCodeService service, MenuPermissionService permissions) {
        this.service = service;
        this.permissions = permissions;
    }

    @GetMapping("/groups")
    CodeGroupListResponse groups(
            @AuthenticationPrincipal CurrentUser currentUser,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "100") @Min(1) @Max(1000) int limit,
            @RequestParam(defaultValue = "false") boolean all,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String name
    ) {
        authorize(currentUser, "query");
        PageResult<CodeGroupItem> result = service.groups(page, limit, all, code, name);
        return new CodeGroupListResponse(result.rows(), result.totalCount(), result.page(), result.limit());
    }

    @PostMapping("/groups")
    @ResponseStatus(HttpStatus.CREATED)
    CodeGroupDetailResponse createGroup(@AuthenticationPrincipal CurrentUser currentUser, @Valid @RequestBody CodeGroupCreatePayload payload) {
        authorize(currentUser, "save");
        return new CodeGroupDetailResponse(service.createGroup(payload.toRequest()));
    }

    @PutMapping("/groups/{groupId}")
    CodeGroupDetailResponse updateGroup(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable long groupId, @Valid @RequestBody CodeGroupUpdatePayload payload) {
        authorize(currentUser, "save");
        return new CodeGroupDetailResponse(service.updateGroup(groupId, payload.toRequest()));
    }

    @DeleteMapping("/groups/{groupId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteGroup(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable long groupId) {
        authorize(currentUser, "save");
        service.deleteGroup(groupId);
    }

    @GetMapping("/groups/{groupId}/items")
    CodeListResponse codes(
            @AuthenticationPrincipal CurrentUser currentUser,
            @PathVariable long groupId,
            @RequestParam(defaultValue = "1") @Min(1) int page,
            @RequestParam(defaultValue = "100") @Min(1) @Max(1000) int limit,
            @RequestParam(defaultValue = "false") boolean all,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String name
    ) {
        authorize(currentUser, "query");
        PageResult<CodeItem> result = service.codes(groupId, page, limit, all, code, name);
        return new CodeListResponse(result.rows(), result.totalCount(), result.page(), result.limit());
    }

    @PostMapping("/groups/{groupId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    CodeDetailResponse createCode(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable long groupId, @Valid @RequestBody CodeCreatePayload payload) {
        authorize(currentUser, "save");
        return new CodeDetailResponse(service.createCode(groupId, payload.toRequest()));
    }

    @PutMapping("/groups/{groupId}/items/{codeId}")
    CodeDetailResponse updateCode(
            @AuthenticationPrincipal CurrentUser currentUser,
            @PathVariable long groupId,
            @PathVariable long codeId,
            @Valid @RequestBody CodeUpdatePayload payload
    ) {
        authorize(currentUser, "save");
        return new CodeDetailResponse(service.updateCode(groupId, codeId, payload.toRequest()));
    }

    @DeleteMapping("/groups/{groupId}/items/{codeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteCode(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable long groupId, @PathVariable long codeId) {
        authorize(currentUser, "save");
        service.deleteCode(groupId, codeId);
    }

    @GetMapping("/groups/by-code/{groupCode}/active")
    ActiveCodeListResponse activeCodes(@PathVariable String groupCode) {
        ActiveCodes result = service.activeCodes(groupCode);
        return new ActiveCodeListResponse(result.groupCode(), result.options());
    }

    private void authorize(CurrentUser currentUser, String action) {
        permissions.requireAdmin(currentUser);
        permissions.requireMenuAction(currentUser.id(), MENU_PATH, action);
    }

    record CodeGroupListResponse(List<CodeGroupItem> groups, long totalCount, Integer page, Integer limit) { }
    record CodeGroupDetailResponse(CodeGroupItem group) { }
    record CodeListResponse(List<CodeItem> codes, long totalCount, Integer page, Integer limit) { }
    record CodeDetailResponse(CodeItem code) { }
    record ActiveCodeListResponse(String groupCode, List<CommonCodeService.ActiveCodeOption> options) { }
    record CodeGroupCreatePayload(
            @NotBlank @Size(max = 30) String code,
            @NotBlank @Size(max = 100) String name,
            String description,
            Boolean isActive,
            Integer sortOrder
    ) { CodeGroupRequest toRequest() { return new CodeGroupRequest(code, name, description, isActive == null || isActive, sortOrder == null ? 0 : sortOrder); } }
    record CodeGroupUpdatePayload(
            @Size(min = 1, max = 30) String code,
            @Size(min = 1, max = 100) String name,
            String description,
            Boolean isActive,
            Integer sortOrder
    ) { CodeGroupUpdateRequest toRequest() { return new CodeGroupUpdateRequest(code, name, description, isActive, sortOrder); } }
    record CodeCreatePayload(
            @NotBlank @Size(max = 30) String code,
            @NotBlank @Size(max = 100) String name,
            String description,
            Boolean isActive,
            Integer sortOrder,
            @Size(max = 200) String extraValue1,
            @Size(max = 200) String extraValue2
    ) { CodeRequest toRequest() { return new CodeRequest(code, name, description, isActive == null || isActive, sortOrder == null ? 0 : sortOrder, extraValue1, extraValue2); } }
    record CodeUpdatePayload(
            @Size(min = 1, max = 30) String code,
            @Size(min = 1, max = 100) String name,
            String description,
            Boolean isActive,
            Integer sortOrder,
            @Size(max = 200) String extraValue1,
            @Size(max = 200) String extraValue2
    ) { CodeUpdateRequest toRequest() { return new CodeUpdateRequest(code, name, description, isActive, sortOrder, extraValue1, extraValue2); } }
}
