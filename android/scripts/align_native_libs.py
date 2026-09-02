#!/usr/bin/env python3
import struct, os, sys

def align_elf_16kb(data):
    if len(data) < 64 or data[:4] != b'\x7fELF' or data[4] != 2 or data[5] != 1:
        return data
        
    e_phoff, = struct.unpack('<Q', data[32:40])
    e_shoff, = struct.unpack('<Q', data[40:48])
    e_phentsize, = struct.unpack('<H', data[54:56])
    e_phnum, = struct.unpack('<H', data[56:58])
    e_shentsize, = struct.unpack('<H', data[58:60])
    e_shnum, = struct.unpack('<H', data[60:62])
    
    load_segments = []
    for i in range(e_phnum):
        off = e_phoff + i * e_phentsize
        p_type, p_flags, p_offset, p_vaddr, p_paddr, p_filesz, p_memsz, p_align = struct.unpack('<IIQQQQQQ', data[off:off+56])
        if p_type == 1:
            load_segments.append((i, off, p_type, p_flags, p_offset, p_vaddr, p_paddr, p_filesz, p_memsz, p_align))

    # If any LOAD segment has align < 0x4000
    needs_alignment = any(seg[9] < 0x4000 for seg in load_segments)
    if not needs_alignment:
        return data

    if len(load_segments) == 2:
        seg1, seg2 = load_segments[0], load_segments[1]
        target_offset_mod = seg2[5] % 0x4000
        cur_offset = seg2[4]
        pad = (target_offset_mod - (cur_offset % 0x4000)) % 0x4000
        if pad == 0 and seg2[9] < 0x4000:
            pad = 0x4000
            
        new_seg2_offset = cur_offset + pad
        
        part1 = bytearray(data[:cur_offset])
        padding = b'\x00' * pad
        part2 = bytearray(data[cur_offset:])
        new_data = part1 + padding + part2
        
        for i in range(e_phnum):
            off = e_phoff + i * e_phentsize
            p_type, p_flags, p_offset, p_vaddr, p_paddr, p_filesz, p_memsz, p_align = struct.unpack('<IIQQQQQQ', new_data[off:off+56])
            new_p_align = 0x4000
            if p_type == 1:
                if p_offset >= cur_offset:
                    p_offset += pad
                struct.pack_into('<IIQQQQQQ', new_data, off, p_type, p_flags, p_offset, p_vaddr, p_paddr, p_filesz, p_memsz, new_p_align)
            elif p_offset >= cur_offset:
                p_offset += pad
                struct.pack_into('<IIQQQQQQ', new_data, off, p_type, p_flags, p_offset, p_vaddr, p_paddr, p_filesz, p_memsz, p_align)

        new_e_shoff = e_shoff + (pad if e_shoff >= cur_offset else 0)
        struct.pack_into('<Q', new_data, 40, new_e_shoff)
        
        for i in range(e_shnum):
            off = new_e_shoff + i * e_shentsize
            sh_name, sh_type, sh_flags, sh_addr, sh_offset, sh_size, sh_link, sh_info, sh_addralign, sh_entsize = struct.unpack('<IIQQQQIIQQ', new_data[off:off+64])
            if sh_offset >= cur_offset:
                sh_offset += pad
            struct.pack_into('<IIQQQQIIQQ', new_data, off, sh_name, sh_type, sh_flags, sh_addr, sh_offset, sh_size, sh_link, sh_info, sh_addralign, sh_entsize)
            
        return bytes(new_data)
    return data

def process_dir(root_dir):
    for root, dirs, files in os.walk(root_dir):
        for f in files:
            if f.endswith('.so'):
                path = os.path.join(root, f)
                with open(path, 'rb') as fp:
                    data = fp.read()
                aligned = align_elf_16kb(data)
                if aligned != data:
                    with open(path, 'wb') as fp:
                        fp.write(aligned)
                    print(f'Aligned 16 KB native lib: {path}')

if __name__ == '__main__':
    for arg in sys.argv[1:]:
        if os.path.exists(arg):
            process_dir(arg)
