package com.vibehr.commoncode;

import com.vibehr.platform.error.ApiException;
import com.vibehr.platform.ids.IntegerId;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("!test")
public class CommonCodeService {

    private final CodeGroupRepository groups;
    private final CodeRepository codes;
    private final Clock clock;

    CommonCodeService(CodeGroupRepository groups, CodeRepository codes, Clock clock) {
        this.groups = groups;
        this.codes = codes;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResult<CodeGroupItem> groups(int page, int limit, boolean all, String code, String name) {
        String normalizedCode = filter(code);
        String normalizedName = filter(name);
        long total = groups.countFiltered(normalizedCode, normalizedName);
        Pageable pageable = all ? Pageable.unpaged() : PageRequest.of(page - 1, limit);
        return new PageResult<>(groups.findFiltered(normalizedCode, normalizedName, pageable).stream().map(this::toGroup).toList(), total, all ? null : page, all ? null : limit);
    }

    @Transactional
    public CodeGroupItem createGroup(CodeGroupRequest request) {
        String code = request.code().strip().toUpperCase(Locale.ROOT);
        if (groups.findByCode(code).isPresent()) throw ApiException.conflict("group code already exists.");
        return toGroup(groups.saveAndFlush(new AppCodeGroup(code, request.name().strip(), request.description(), request.isActive(), request.sortOrder(), now())));
    }

    @Transactional
    public CodeGroupItem updateGroup(long groupId, CodeGroupUpdateRequest request) {
        int id = IntegerId.required(groupId, "group_id");
        AppCodeGroup group = group(id);
        if (request.code() != null) {
            String next = request.code().strip().toUpperCase(Locale.ROOT);
            if (groups.findByCode(next).filter(found -> !found.getId().equals(id)).isPresent()) throw ApiException.conflict("group code already exists.");
        }
        group.update(request.code(), request.name(), request.description(), request.isActive(), request.sortOrder(), now());
        return toGroup(group);
    }

    @Transactional
    public void deleteGroup(long groupId) { groups.delete(group(IntegerId.required(groupId, "group_id"))); }

    @Transactional(readOnly = true)
    public PageResult<CodeItem> codes(long groupId, int page, int limit, boolean all, String code, String name) {
        int id = IntegerId.required(groupId, "group_id");
        group(id);
        String normalizedCode = filter(code);
        String normalizedName = filter(name);
        long total = codes.countFiltered(id, normalizedCode, normalizedName);
        Pageable pageable = all ? Pageable.unpaged() : PageRequest.of(page - 1, limit);
        return new PageResult<>(codes.findFiltered(id, normalizedCode, normalizedName, pageable).stream().map(this::toCode).toList(), total, all ? null : page, all ? null : limit);
    }

    @Transactional
    public CodeItem createCode(long groupId, CodeRequest request) {
        int id = IntegerId.required(groupId, "group_id");
        group(id);
        String code = request.code().strip().toUpperCase(Locale.ROOT);
        if (codes.findByGroupIdAndCode(id, code).isPresent()) throw ApiException.conflict("code already exists in group.");
        return toCode(codes.saveAndFlush(new AppCode(id, code, request.name().strip(), request.description(), request.isActive(), request.sortOrder(), request.extraValue1(), request.extraValue2(), now())));
    }

    @Transactional
    public CodeItem updateCode(long groupId, long codeId, CodeUpdateRequest request) {
        int group = IntegerId.required(groupId, "group_id");
        int id = IntegerId.required(codeId, "code_id");
        AppCode code = code(group, id);
        if (request.code() != null) {
            String next = request.code().strip().toUpperCase(Locale.ROOT);
            if (codes.findByGroupIdAndCode(group, next).filter(found -> !found.getId().equals(id)).isPresent()) throw ApiException.conflict("code already exists in group.");
        }
        code.update(request.code(), request.name(), request.description(), request.isActive(), request.sortOrder(), request.extraValue1(), request.extraValue2(), now());
        return toCode(code);
    }

    @Transactional
    public void deleteCode(long groupId, long codeId) { codes.delete(code(IntegerId.required(groupId, "group_id"), IntegerId.required(codeId, "code_id"))); }

    @Transactional(readOnly = true)
    public ActiveCodes activeCodes(String groupCode) {
        String normalized = groupCode.strip().toUpperCase(Locale.ROOT);
        AppCodeGroup group = groups.findByCode(normalized).orElseThrow(() -> ApiException.notFound("Code group not found."));
        return new ActiveCodes(normalized, codes.findByGroupIdAndActiveTrueOrderBySortOrderAscIdAsc(group.getId()).stream().map(row -> new ActiveCodeOption(row.getCode(), row.getName())).toList());
    }

    private AppCodeGroup group(int id) { return groups.findById(id).orElseThrow(() -> ApiException.notFound("Code group not found.")); }
    private AppCode code(int groupId, int codeId) {
        return codes.findById(codeId).filter(row -> row.getGroupId().equals(groupId)).orElseThrow(() -> ApiException.notFound("Code not found."));
    }
    private CodeGroupItem toGroup(AppCodeGroup row) { return new CodeGroupItem(row.getId(), row.getCode(), row.getName(), row.getDescription(), row.isActive(), row.getSortOrder(), row.getCreatedAt(), row.getUpdatedAt()); }
    private CodeItem toCode(AppCode row) { return new CodeItem(row.getId(), row.getGroupId(), row.getCode(), row.getName(), row.getDescription(), row.isActive(), row.getSortOrder(), row.getExtraValue1(), row.getExtraValue2(), row.getCreatedAt(), row.getUpdatedAt()); }
    private LocalDateTime now() { return LocalDateTime.now(clock); }
    private static String filter(String value) { return value == null || value.isEmpty() ? null : value.strip(); }

    public record PageResult<T>(List<T> rows, long totalCount, Integer page, Integer limit) { }
    public record CodeGroupItem(long id, String code, String name, String description, boolean isActive, int sortOrder, LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record CodeItem(long id, long groupId, String code, String name, String description, boolean isActive, int sortOrder, String extraValue1, String extraValue2, LocalDateTime createdAt, LocalDateTime updatedAt) { }
    public record ActiveCodeOption(String code, String name) { }
    public record ActiveCodes(String groupCode, List<ActiveCodeOption> options) { }
    public record CodeGroupRequest(String code, String name, String description, boolean isActive, int sortOrder) { }
    public record CodeGroupUpdateRequest(String code, String name, String description, Boolean isActive, Integer sortOrder) { }
    public record CodeRequest(String code, String name, String description, boolean isActive, int sortOrder, String extraValue1, String extraValue2) { }
    public record CodeUpdateRequest(String code, String name, String description, Boolean isActive, Integer sortOrder, String extraValue1, String extraValue2) { }
}
